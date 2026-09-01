import type { DowntimeSegment, RuntimeSegment, StoppageSegment } from '../types/api';

export type SegmentKind =
  | 'runtime'
  | 'unplanned-production'
  | 'unknown-downtime'
  | 'planned-downtime'
  | 'stoppage'
  | 'other-downtime';

export const SEGMENT_COLORS: Record<SegmentKind, string> = {
  runtime: '#1f9e8e',
  'unplanned-production': '#c7d92f',
  'unknown-downtime': '#f28c6b',
  'planned-downtime': '#2e7d32',
  stoppage: '#7b5fd9',
  'other-downtime': '#b0bec5',
};

export const SEGMENT_LABELS: Record<SegmentKind, string> = {
  runtime: 'Runtime',
  'unplanned-production': 'Unplanned Production',
  'unknown-downtime': 'Unknown Downtime',
  'planned-downtime': 'Planned Downtime',
  stoppage: 'Stoppage',
  'other-downtime': 'Downtime',
};

export function runtimeKind(rt: RuntimeSegment): SegmentKind {
  return rt.type === 'unknown unplanned production' ? 'unplanned-production' : 'runtime';
}

/**
 * The live backend returns exactly two downtime types: "unknown" and "planned" (verified
 * against real data). Any other value is mapped to a generic "other-downtime" bucket so a
 * type we haven't seen still renders and counts toward the table's totals, rather than being
 * silently dropped — see hourlyBuckets.ts's otherDowntimeMin row.
 */
export function downtimeKind(dt: DowntimeSegment): SegmentKind {
  if (dt.type === 'unknown') return 'unknown-downtime';
  if (dt.type === 'planned') return 'planned-downtime';
  return 'other-downtime';
}

export function stoppageKind(_sp: StoppageSegment): SegmentKind {
  return 'stoppage';
}
