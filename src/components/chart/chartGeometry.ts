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
}

export interface ChartData {
  segments: SegmentGeom[]; // sorted by startMs
  markers: MarkerGeom[]; // sorted by tsMs — from produces (exact) or synthesized from produce_counts (coarse)
  domainStartMs: number;
  domainEndMs: number;
}

function segmentLabel(kind: SegmentKind): string {
  switch (kind) {
    case 'runtime':
      return 'Runtime';
    case 'unplanned-production':
      return 'Unplanned Production';
    case 'unknown-downtime':
      return 'Unknown Downtime';
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

  const markers: MarkerGeom[] = [];

  if (useExactProduces && intervals.produces) {
    for (const bucket of intervals.produces as ProduceBucket[]) {
      for (const p of bucket.produces) {
        markers.push({ tsMs: Date.parse(p.first_seen_ts), result: p.result, id: p.produce_id });
      }
    }
  } else {
    // Coarse mode: synthesize one marker per hour bucket per result, count encoded via id suffix.
    // We don't have individual timestamps, so we spread synthetic points evenly within the hour
    // for OK/NG counts — this keeps the same rendering path for both modes.
    for (const pc of intervals.produce_counts as ProduceCountBucket[]) {
      const bucketStartMs = Date.parse(pc.bucket_start);
      spreadSynthetic(bucketStartMs, pc.ok_count, 'PASS', pc.part_model_id, markers);
      spreadSynthetic(bucketStartMs, pc.ng_count, 'FAIL', pc.part_model_id, markers);
    }
  }

  markers.sort((a, b) => a.tsMs - b.tsMs);

  return { segments, markers, domainStartMs, domainEndMs };
}

function spreadSynthetic(
  bucketStartMs: number,
  count: number,
  result: 'PASS' | 'FAIL',
  partModelId: string,
  out: MarkerGeom[],
) {
  const HOUR_MS = 60 * 60 * 1000;
  for (let i = 0; i < count; i++) {
    const frac = (i + 0.5) / count;
    out.push({
      tsMs: bucketStartMs + frac * HOUR_MS,
      result,
      id: `${partModelId}-${result}-${bucketStartMs}-${i}`,
    });
  }
}
