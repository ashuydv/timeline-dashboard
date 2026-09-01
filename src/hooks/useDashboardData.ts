import { useCallback, useEffect, useRef, useState } from 'react';
import { getCycleTimeMetrics, getMachineIntervals } from '../api/endpoints';
import type { CycleTimeBucket, EntityScope, MachineIntervalsResponse, TimeRange } from '../types/api';

export interface DashboardDataState {
  intervals: MachineIntervalsResponse | null;
  cycleTime: CycleTimeBucket[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface Params {
  entityScope: EntityScope | null;
  timeRange: TimeRange | null;
  exactProduces: boolean;
}

export function useDashboardData({ entityScope, timeRange, exactProduces }: Params): DashboardDataState {
  const [intervals, setIntervals] = useState<MachineIntervalsResponse | null>(null);
  const [cycleTime, setCycleTime] = useState<CycleTimeBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchData = useCallback(() => {
    if (!entityScope || !timeRange) return;

    const myRequestId = ++requestId.current;
    setLoading(true);
    setError(null);

    Promise.all([
      getMachineIntervals({
        entity_scope: entityScope,
        time_range: timeRange,
        produce_counts: true,
        exact_produces: exactProduces,
        group_produce_counts_by_part_model: true,
      }),
      getCycleTimeMetrics({
        entity_scope: entityScope,
        time_range: timeRange,
        metrics: ['ideal_cycle_time_seconds', 'actual_cycle_time_seconds'],
        distribution: 'hourly',
      }),
    ])
      .then(([intervalsRes, cycleTimeRes]) => {
        if (myRequestId !== requestId.current) return;
        setIntervals(intervalsRes);
        setCycleTime(cycleTimeRes);
        setLoading(false);
      })
      .catch((err) => {
        if (myRequestId !== requestId.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        setLoading(false);
      });
  }, [entityScope, timeRange, exactProduces]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { intervals, cycleTime, loading, error, refetch: fetchData };
}
