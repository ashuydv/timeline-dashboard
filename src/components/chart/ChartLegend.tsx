import { Box, Typography } from '@mui/material';
import { SEGMENT_COLORS, SEGMENT_LABELS } from '../../utils/segmentKind';

const PASS_COLOR = '#2e7d32';
const FAIL_COLOR = '#d32f2f';

export default function ChartLegend() {
  const segmentKinds = ['runtime', 'unplanned-production', 'unknown-downtime', 'stoppage'] as const;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center', mb: 1 }}>
      {segmentKinds.map((kind) => (
        <LegendItem key={kind} color={SEGMENT_COLORS[kind]} label={SEGMENT_LABELS[kind]} shape="square" />
      ))}
      <LegendItem color={PASS_COLOR} label="Pass" shape="circle" />
      <LegendItem color={FAIL_COLOR} label="Fail" shape="circle" />
    </Box>
  );
}

function LegendItem({ color, label, shape }: { color: string; label: string; shape: 'square' | 'circle' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          width: 12,
          height: 12,
          bgcolor: color,
          borderRadius: shape === 'circle' ? '50%' : 0.5,
        }}
      />
      <Typography variant="caption">{label}</Typography>
    </Box>
  );
}
