import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  FormControlLabel,
  TextField,
  IconButton,
  Paper,
  CircularProgress,
  Tooltip,
  type SelectChangeEvent,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { FlatAssetOption } from '../utils/assetTree';
import type { ShiftOption } from '../utils/shiftOptions';
import { shiftOptionKey } from '../utils/shiftOptions';

interface FilterBarProps {
  assets: FlatAssetOption[];
  shiftOptions: ShiftOption[];
  selectedAssetId: string;
  onAssetChange: (id: string) => void;
  selectedShiftKey: string;
  onShiftChange: (key: string) => void;
  date: string; // yyyy-MM-dd
  onDateChange: (date: string) => void;
  showIndividualProduces: boolean;
  onToggleIndividualProduces: (v: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
  minDate: string;
  maxDate: string;
}

export default function FilterBar({
  assets,
  shiftOptions,
  selectedAssetId,
  onAssetChange,
  selectedShiftKey,
  onShiftChange,
  date,
  onDateChange,
  showIndividualProduces,
  onToggleIndividualProduces,
  onRefresh,
  refreshing,
  minDate,
  maxDate,
}: FilterBarProps) {
  return (
    <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="asset-label">Machine / Line</InputLabel>
          <Select
            labelId="asset-label"
            label="Machine / Line"
            value={selectedAssetId}
            onChange={(e: SelectChangeEvent) => onAssetChange(e.target.value)}
          >
            {assets.map((a) => (
              <MenuItem key={a.id} value={a.id} sx={{ pl: 2 + a.depth * 2 }}>
                {a.label.trim()}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="shift-label">Shift</InputLabel>
          <Select
            labelId="shift-label"
            label="Shift"
            value={selectedShiftKey}
            onChange={(e: SelectChangeEvent) => onShiftChange(e.target.value)}
          >
            {shiftOptions.map((opt) => (
              <MenuItem key={shiftOptionKey(opt)} value={shiftOptionKey(opt)}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Date"
          type="date"
          size="small"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: minDate, max: maxDate }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={showIndividualProduces}
              onChange={(e) => onToggleIndividualProduces(e.target.checked)}
            />
          }
          label="Show individual produces"
        />

        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={onRefresh} disabled={refreshing} color="primary">
              {refreshing ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Paper>
  );
}
