import { Box, Typography } from '@mui/material';
import { SEGMENT_COLORS, SEGMENT_LABELS } from '../../utils/segmentKind';
import type { PartModelSeries } from './chartGeometry';

const FAIL_COLOR = '#d32f2f';

interface ChartLegendProps {
  partModelSeries?: PartModelSeries[];
  partModelNames?: Record<string, string>;
}

export default function ChartLegend({ partModelSeries = [], partModelNames = {} }: ChartLegendProps) {
  const segmentKinds = ['runtime', 'unplanned-production', 'unknown-downtime', 'stoppage'] as const;

  return (
    <Box sx={{ mb: 1 }}>
      {partModelSeries.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Part Models:
          </Typography>
          {partModelSeries.map((s) => (
            <LegendItem
              key={s.partModelId}
              color={s.color}
              label={partModelNames[s.partModelId] ?? s.partModelId.slice(0, 8)}
              shape="circle"
            />
          ))}
        </Box>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
        {segmentKinds.map((kind) => (
          <LegendItem key={kind} color={SEGMENT_COLORS[kind]} label={SEGMENT_LABELS[kind]} shape="square" />
        ))}
        <LegendItem color="#616161" label="Pass (circle on line)" shape="circle" />
        <LegendItem color={FAIL_COLOR} label="Fail (cross)" shape="cross" />
      </Box>
    </Box>
  );
}

function LegendItem({ color, label, shape }: { color: string; label: string; shape: 'square' | 'circle' | 'cross' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {shape === 'cross' ? (
        <Box sx={{ position: 'relative', width: 12, height: 12 }}>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              '&::before, &::after': {
                content: '""',
                position: 'absolute',
                top: '50%',
                left: 0,
                width: '100%',
                height: '2px',
                bgcolor: color,
              },
              '&::before': { transform: 'rotate(45deg)' },
              '&::after': { transform: 'rotate(-45deg)' },
            }}
          />
        </Box>
      ) : (
        <Box
          sx={{
            width: 12,
            height: 12,
            bgcolor: color,
            borderRadius: shape === 'circle' ? '50%' : 0.5,
          }}
        />
      )}
      <Typography variant="caption">{label}</Typography>
    </Box>
  );
}
