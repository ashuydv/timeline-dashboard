import { istHourBucketStart } from './time';
import type {
  CycleTimeBucket,
  DowntimeSegment,
  MachineIntervalsResponse,
  ProduceCountBucket,
  RuntimeSegment,
  StoppageSegment,
} from '../types/api';

export interface HourColumn {
  /** Hour bucket start, as a UTC Date whose IST wall-clock value is on the hour. */
  bucketStartUtc: Date;
  bucketEndUtc: Date;
  label: string; // "08:00 - 09:00" in IST
}

export interface HourlyRow {
  total: number;
  pass: number;
  fail: number;
  runtimeMin: number;
  unplannedProductionMin: number;
  stoppageMin: number;
  unknownDowntimeMin: number;
  idealCycleTimeSeconds: number | null;
  actualCycleTimeSeconds: number | null;
  isFuture: boolean; // bucket starts after "now" IST — leave blank per 2.4 in-progress rule
}

/** Build the list of clock-hour columns (IST) spanning [fromUtc, toUtc). */
export function buildHourColumns(fromUtc: Date, toUtc: Date): HourColumn[] {
  const columns: HourColumn[] = [];
  let cursor = istHourBucketStart(fromUtc.toISOString());
  while (cursor.getTime() < toUtc.getTime()) {
    const next = new Date(cursor.getTime() + 60 * 60 * 1000);
    columns.push({
      bucketStartUtc: cursor,
      bucketEndUtc: next,
      label: formatHourRangeIst(cursor, next),
    });
    cursor = next;
  }
  return columns;
}

function formatHourRangeIst(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).format(d);
  return `${fmt(start)} - ${fmt(end)}`;
}

/**
 * Split a UTC [start,end) segment across the given hour columns, returning the
 * number of minutes of overlap with each column index. Segments are already
 * tiled/clipped by the backend — this only cuts at hour boundaries.
 */
function distributeMinutes(startUtc: Date, endUtc: Date, columns: HourColumn[], addTo: (idx: number, minutes: number) => void) {
  const s = startUtc.getTime();
  const e = endUtc.getTime();
  if (e <= s) return;

  for (let i = 0; i < columns.length; i++) {
    const colStart = columns[i].bucketStartUtc.getTime();
    const colEnd = columns[i].bucketEndUtc.getTime();
    const overlapStart = Math.max(s, colStart);
    const overlapEnd = Math.min(e, colEnd);
    if (overlapEnd > overlapStart) {
      addTo(i, (overlapEnd - overlapStart) / 60000);
    }
  }
}

export function computeHourlyRows(
  columns: HourColumn[],
  intervals: Pick<MachineIntervalsResponse, 'runtimes' | 'downtimes' | 'stoppages' | 'produce_counts'>,
  cycleTimeBuckets: CycleTimeBucket[],
  nowUtc: Date,
): HourlyRow[] {
  const rows: HourlyRow[] = columns.map((col) => ({
    total: 0,
    pass: 0,
    fail: 0,
    runtimeMin: 0,
    unplannedProductionMin: 0,
    stoppageMin: 0,
    unknownDowntimeMin: 0,
    idealCycleTimeSeconds: null,
    actualCycleTimeSeconds: null,
    isFuture: col.bucketStartUtc.getTime() > nowUtc.getTime(),
  }));

  for (const rt of intervals.runtimes as RuntimeSegment[]) {
    const start = new Date(rt.start_at);
    const end = new Date(rt.end_at);
    distributeMinutes(start, end, columns, (idx, minutes) => {
      rows[idx].runtimeMin += minutes;
      if (rt.type === 'unknown unplanned production') {
        rows[idx].unplannedProductionMin += minutes;
      }
    });
  }

  for (const dt of intervals.downtimes as DowntimeSegment[]) {
    const start = new Date(dt.start_at);
    const end = new Date(dt.end_at);
    distributeMinutes(start, end, columns, (idx, minutes) => {
      if (dt.type === 'unknown') {
        rows[idx].unknownDowntimeMin += minutes;
      }
    });
  }

  for (const sp of intervals.stoppages as StoppageSegment[]) {
    const start = new Date(sp.start_at);
    const end = new Date(sp.end_at);
    distributeMinutes(start, end, columns, (idx, minutes) => {
      rows[idx].stoppageMin += minutes;
    });
  }

  const columnIndexByBucketMs = new Map<number, number>();
  columns.forEach((col, idx) => columnIndexByBucketMs.set(col.bucketStartUtc.getTime(), idx));

  for (const pc of intervals.produce_counts as ProduceCountBucket[]) {
    const bucketUtc = istHourBucketStart(pc.bucket_start);
    const idx = columnIndexByBucketMs.get(bucketUtc.getTime());
    if (idx === undefined) continue;
    rows[idx].pass += pc.ok_count;
    rows[idx].fail += pc.ng_count;
    rows[idx].total += pc.ok_count + pc.ng_count;
  }

  for (const ct of cycleTimeBuckets) {
    const bucketUtc = istHourBucketStart(ct.bucket_start);
    const idx = columnIndexByBucketMs.get(bucketUtc.getTime());
    if (idx === undefined) continue;
    rows[idx].idealCycleTimeSeconds = ct.ideal_cycle_time_seconds;
    rows[idx].actualCycleTimeSeconds = ct.actual_cycle_time_seconds;
  }

  return rows;
}
