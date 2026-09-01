import { useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material';
import AppShell from '../components/AppShell';
import FilterBar from '../components/FilterBar';
import TimelineChart from '../components/chart/TimelineChart';
import ChartLegend from '../components/chart/ChartLegend';
import HourlyTable from '../components/HourlyTable';
import { useFilterOptions } from '../hooks/useFilterOptions';
import { useDashboardData } from '../hooks/useDashboardData';
import { buildShiftTimeRangeUtc } from '../utils/time';
import { shiftOptionKey } from '../utils/shiftOptions';
import { buildChartData } from '../components/chart/chartGeometry';
import { buildHourColumns, computeHourlyRows } from '../utils/hourlyBuckets';
import type { EntityScope } from '../types/api';

const DATA_MIN_DATE = '2026-06-22';
const DATA_MAX_DATE = '2026-06-25';
const DEFAULT_DATE = '2026-06-23';

export default function DashboardPage() {
  const { assets, shiftOptions, loading: filtersLoading, error: filtersError } = useFilterOptions();

  const [selectedAssetIdRaw, setSelectedAssetId] = useState('');
  const [selectedShiftKeyRaw, setSelectedShiftKey] = useState('');
  const [date, setDate] = useState(DEFAULT_DATE);
  const [showIndividualProduces, setShowIndividualProduces] = useState(false);

  // Default to the deepest-looking asset and the first shift option once loaded, without an
  // extra effect-driven render pass — derive the effective selection straight from render state.
  const selectedAssetId =
    selectedAssetIdRaw || (assets.length > 0 ? assets[assets.length - 1].id : '');
  const selectedShiftKey =
    selectedShiftKeyRaw || (shiftOptions.length > 0 ? shiftOptionKey(shiftOptions[0]) : '');

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) ?? null;
  const selectedShift = shiftOptions.find((o) => shiftOptionKey(o) === selectedShiftKey) ?? null;

  const entityScope: EntityScope | null = selectedAsset
    ? { type: 'asset', asset: { asset_id: selectedAsset.id, asset_level_id: selectedAsset.assetlevel_id } }
    : null;

  const timeRange = useMemo(() => {
    if (!selectedShift) return null;
    return buildShiftTimeRangeUtc(date, selectedShift.startHHMM, selectedShift.endHHMM, selectedShift.crossesMidnight);
  }, [date, selectedShift]);

  const { intervals, cycleTime, loading, error, refetch } = useDashboardData({
    entityScope,
    timeRange,
    exactProduces: showIndividualProduces,
  });

  const chartData = useMemo(() => {
    if (!intervals || !timeRange) return null;
    return buildChartData(
      intervals,
      Date.parse(timeRange.from_ts),
      Date.parse(timeRange.to_ts),
      showIndividualProduces,
    );
  }, [intervals, timeRange, showIndividualProduces]);

  const hourColumns = useMemo(() => {
    if (!timeRange) return [];
    return buildHourColumns(new Date(timeRange.from_ts), new Date(timeRange.to_ts));
  }, [timeRange]);

  const hourlyRows = useMemo(() => {
    if (!intervals || hourColumns.length === 0) return [];
    return computeHourlyRows(hourColumns, intervals, cycleTime, new Date());
  }, [intervals, cycleTime, hourColumns]);

  const isEmpty =
    !!intervals &&
    intervals.runtimes.length === 0 &&
    intervals.downtimes.length === 0 &&
    intervals.stoppages.length === 0 &&
    intervals.produce_counts.length === 0;

  return (
    <AppShell>
      <FilterBar
        assets={assets}
        shiftOptions={shiftOptions}
        selectedAssetId={selectedAssetId}
        onAssetChange={setSelectedAssetId}
        selectedShiftKey={selectedShiftKey}
        onShiftChange={setSelectedShiftKey}
        date={date}
        onDateChange={setDate}
        showIndividualProduces={showIndividualProduces}
        onToggleIndividualProduces={setShowIndividualProduces}
        onRefresh={refetch}
        refreshing={loading}
        minDate={DATA_MIN_DATE}
        maxDate={DATA_MAX_DATE}
      />

      {filtersError && <Alert severity="error" sx={{ mb: 2 }}>{filtersError}</Alert>}

      {filtersLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="error" gutterBottom>
            {error}
          </Typography>
          <Button variant="contained" onClick={refetch} sx={{ mt: 1 }}>
            Retry
          </Button>
        </Paper>
      ) : loading && !intervals ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
          <CircularProgress />
        </Box>
      ) : isEmpty ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No data for this machine, date, and shift.</Typography>
        </Paper>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <ChartLegend />
            {chartData && <TimelineChart data={chartData} />}
          </Box>
          <HourlyTable columns={hourColumns} rows={hourlyRows} />
        </>
      )}
    </AppShell>
  );
}
