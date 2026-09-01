import type { DowntimeSegment, RuntimeSegment, StoppageSegment } from '../types/api';

export type SegmentKind = 'runtime' | 'unplanned-production' | 'unknown-downtime' | 'stoppage' | 'other-downtime';

export const SEGMENT_COLORS: Record<SegmentKind, string> = {
  runtime: '#1f9e8e',
  'unplanned-production': '#c7d92f',
  'unknown-downtime': '#f28c6b',
  stoppage: '#7b5fd9',
  'other-downtime': '#b0bec5',
};

export const SEGMENT_LABELS: Record<SegmentKind, string> = {
  runtime: 'Runtime',
  'unplanned-production': 'Unplanned Production',
  'unknown-downtime': 'Unknown Downtime',
  stoppage: 'Stoppage',
  'other-downtime': 'Downtime',
};

export function runtimeKind(rt: RuntimeSegment): SegmentKind {
  return rt.type === 'unknown unplanned production' ? 'unplanned-production' : 'runtime';
}

export function downtimeKind(dt: DowntimeSegment): SegmentKind {
  return dt.type === 'unknown' ? 'unknown-downtime' : 'other-downtime';
}

export function stoppageKind(_sp: StoppageSegment): SegmentKind {
  return 'stoppage';
}
