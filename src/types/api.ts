// Shapes of the unwrapped `data` payloads from the MES backend.
// Every raw response is wrapped in { trace_id, status_code, message, data } — see api/client.ts.

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  email: string;
  roles: string[];
  customer_id?: string;
  customer_name?: string;
  [key: string]: unknown;
}

export interface AssetNode {
  id: string;
  name: string;
  codename?: string | null;
  assetlevel_id: number;
  hierarchy?: string | null;
  children: AssetNode[];
}

export interface Shift {
  id: string;
  code: string;
  name: string;
  shift_timings: string[]; // "HH:MM" IST start times, sorted; last wraps to first
  is_active: boolean;
}

export type RuntimeType = 'planned' | 'unknown unplanned production' | string;
export type DowntimeType = 'unknown' | string;

export interface RuntimeSegment {
  start_at: string; // UTC ISO
  end_at: string; // UTC ISO
  type: RuntimeType;
  runtime_name: string | null;
}

export interface DowntimeSegment {
  start_at: string;
  end_at: string;
  type: DowntimeType;
  downtime_name: string | null;
}

export interface StoppageSegment {
  start_at: string;
  end_at: string;
  type: string;
  stoppage_name?: string | null;
}

export interface ProduceCountBucket {
  bucket_start: string; // UTC ISO, hour-aligned
  part_model_id: string;
  ok_count: number;
  ng_count: number;
}

export interface ProduceRow {
  produce_id: string;
  first_seen_ts: string; // UTC ISO — NOT sorted
  result: 'PASS' | 'FAIL';
  produce_type: string;
  part_model_id: string;
}

export interface ProduceBucket {
  bucket_start: string;
  part_model_id: string;
  produces: ProduceRow[];
}

export interface MachineIntervalsResponse {
  machine_ids: number[];
  runtimes: RuntimeSegment[];
  downtimes: DowntimeSegment[];
  stoppages: StoppageSegment[];
  produce_counts: ProduceCountBucket[];
  produces?: ProduceBucket[];
}

export interface CycleTimeBucket {
  entity_id: string;
  bucket_start: string;
  ideal_cycle_time_seconds: number | null;
  actual_cycle_time_seconds: number | null;
  [key: string]: unknown;
}

export interface EntityScope {
  type: 'asset';
  asset: {
    asset_id: string;
    asset_level_id: number;
  };
}

export interface TimeRange {
  from_ts: string; // UTC ISO
  to_ts: string; // UTC ISO
}

export interface MachineIntervalsRequest {
  entity_scope: EntityScope;
  time_range: TimeRange;
  produce_counts: boolean;
  exact_produces: boolean;
  group_produce_counts_by_part_model: boolean;
}

export interface CycleTimeRequest {
  entity_scope: EntityScope;
  metrics: string[];
  time_range: TimeRange;
  distribution: 'hourly';
}

export interface MesEnvelope<T> {
  trace_id: string;
  status_code: number;
  message: string;
  data: T;
}
