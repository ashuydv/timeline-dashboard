import type {
  DowntimeSegment,
  MachineIntervalsResponse,
  ProduceBucket,
  ProduceCountBucket,
  RuntimeSegment,
  StoppageSegment,
} from '../../types/api';
import { downtimeKind, runtimeKind, stoppageKind, SEGMENT_COLORS, type SegmentKind } from '../../utils/segmentKind';

export interface SegmentGeom {
  startMs: number;
  endMs: number;
  kind: SegmentKind;
  color: string;
  label: string;
}

export interface MarkerGeom {
  tsMs: number;
  result: 'PASS' | 'FAIL';
  id: string;
  partModelId: string;
  cumulativeCount: number; // running OK+NG total for this part model, at this point
}

export interface PartModelSeries {
  partModelId: string;
  color: string;
  points: MarkerGeom[]; // sorted by tsMs, cumulativeCount is monotonically non-decreasing
}

export interface ChartData {
  segments: SegmentGeom[]; // sorted by startMs
  series: PartModelSeries[]; // one per part model, each independently cumulative
  maxCumulativeCount: number; // for y-axis scaling
  domainStartMs: number;
  domainEndMs: number;
  lastObserveTsMs: number | null;
  unknownSegmentCount: number;
  unknownSegmentMinutes: number;
}

const PART_MODEL_COLORS = ['#1976d2', '#8e24aa', '#00838f', '#f9a825', '#5d4037', '#c2185b'];

function colorForPartModel(index: number): string {
  return PART_MODEL_COLORS[index % PART_MODEL_COLORS.length] ?? '#1976d2';
}

function segmentLabel(kind: SegmentKind): string {
  switch (kind) {
    case 'runtime':
      return 'Runtime';
    case 'unplanned-production':
      return 'Unplanned Production';
    case 'unknown-downtime':
      return 'Unknown';
    case 'stoppage':
      return 'Stoppage';
    default:
      return 'Downtime';
  }
}

/** Resolve raw API arrays into flat, pre-sorted, render-ready geometry. Done once per fetch — not per frame. */
export function buildChartData(
  intervals: MachineIntervalsResponse,
  domainStartMs: number,
  domainEndMs: number,
  useExactProduces: boolean,
): ChartData {
  const segments: SegmentGeom[] = [];

  for (const rt of intervals.runtimes as RuntimeSegment[]) {
    const kind = runtimeKind(rt);
    segments.push({
      startMs: Date.parse(rt.start_at),
      endMs: Date.parse(rt.end_at),
      kind,
      color: SEGMENT_COLORS[kind],
      label: segmentLabel(kind),
    });
  }
  for (const dt of intervals.downtimes as DowntimeSegment[]) {
    const kind = downtimeKind(dt);
    segments.push({
      startMs: Date.parse(dt.start_at),
      endMs: Date.parse(dt.end_at),
      kind,
      color: SEGMENT_COLORS[kind],
      label: segmentLabel(kind),
    });
  }
  for (const sp of intervals.stoppages as StoppageSegment[]) {
    const kind = stoppageKind(sp);
    segments.push({
      startMs: Date.parse(sp.start_at),
      endMs: Date.parse(sp.end_at),
      kind,
      color: SEGMENT_COLORS[kind],
      label: segmentLabel(kind),
    });
  }
  segments.sort((a, b) => a.startMs - b.startMs);

  let unknownSegmentCount = 0;
  let unknownSegmentMinutes = 0;
  for (const seg of segments) {
    if (seg.kind === 'unknown-downtime') {
      unknownSegmentCount++;
      unknownSegmentMinutes += (seg.endMs - seg.startMs) / 60000;
    }
  }

  // Flatten raw produce rows per part model (exact mode), or synthesize evenly-spaced
  // timestamps within each hour from produce_counts (coarse mode) so both modes share
  // the same downstream cumulative/rendering path.
  const rawByPartModel = new Map<string, { tsMs: number; result: 'PASS' | 'FAIL'; id: string }[]>();

  const pushRaw = (partModelId: string, tsMs: number, result: 'PASS' | 'FAIL', id: string) => {
    let arr = rawByPartModel.get(partModelId);
    if (!arr) {
      arr = [];
      rawByPartModel.set(partModelId, arr);
    }
    arr.push({ tsMs, result, id });
  };

  if (useExactProduces && intervals.produces) {
    for (const bucket of intervals.produces as ProduceBucket[]) {
      for (const p of bucket.produces) {
        pushRaw(p.part_model_id, Date.parse(p.first_seen_ts), p.result, p.produce_id);
      }
    }
  } else {
    for (const pc of intervals.produce_counts as ProduceCountBucket[]) {
      const bucketStartMs = Date.parse(pc.bucket_start);
      spreadSynthetic(bucketStartMs, pc.ok_count, 'PASS', pc.part_model_id, pushRaw);
      spreadSynthetic(bucketStartMs, pc.ng_count, 'FAIL', pc.part_model_id, pushRaw);
    }
  }

  const series: PartModelSeries[] = [];
  let maxCumulativeCount = 0;
  let lastObserveTsMs: number | null = null;
  let partIndex = 0;

  for (const [partModelId, raw] of rawByPartModel) {
    raw.sort((a, b) => a.tsMs - b.tsMs); // first_seen_ts is NOT sorted by the API — sort explicitly
    const color = colorForPartModel(partIndex++);
    const points: MarkerGeom[] = [];
    let running = 0;
    for (const r of raw) {
      running += 1;
      points.push({ tsMs: r.tsMs, result: r.result, id: r.id, partModelId, cumulativeCount: running });
    }
    if (points.length > 0) {
      maxCumulativeCount = Math.max(maxCumulativeCount, running);
      const last = points[points.length - 1].tsMs;
      lastObserveTsMs = lastObserveTsMs === null ? last : Math.max(lastObserveTsMs, last);
    }
    series.push({ partModelId, color, points });
  }

  return {
    segments,
    series,
    maxCumulativeCount,
    domainStartMs,
    domainEndMs,
    lastObserveTsMs,
    unknownSegmentCount,
    unknownSegmentMinutes,
  };
}

function spreadSynthetic(
  bucketStartMs: number,
  count: number,
  result: 'PASS' | 'FAIL',
  partModelId: string,
  push: (partModelId: string, tsMs: number, result: 'PASS' | 'FAIL', id: string) => void,
) {
  const HOUR_MS = 60 * 60 * 1000;
  for (let i = 0; i < count; i++) {
    const frac = (i + 0.5) / count;
    push(partModelId, bucketStartMs + frac * HOUR_MS, result, `${partModelId}-${result}-${bucketStartMs}-${i}`);
  }
}
