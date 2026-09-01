import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import type { HourColumn, HourlyRow } from '../utils/hourlyBuckets';

interface HourlyTableProps {
  columns: HourColumn[];
  rows: HourlyRow[];
}

const ROW_DEFS: { key: keyof HourlyRow; label: string; fmt: (v: HourlyRow) => string }[] = [
  { key: 'total', label: 'Total', fmt: (r) => String(r.total) },
  { key: 'pass', label: 'Pass', fmt: (r) => String(r.pass) },
  { key: 'fail', label: 'Fail', fmt: (r) => String(r.fail) },
  { key: 'runtimeMin', label: 'Runtime', fmt: (r) => minutesLabel(r.runtimeMin) },
  { key: 'unplannedProductionMin', label: 'Unplanned Production', fmt: (r) => minutesLabel(r.unplannedProductionMin) },
  { key: 'stoppageMin', label: 'Stoppage', fmt: (r) => minutesLabel(r.stoppageMin) },
  { key: 'unknownDowntimeMin', label: 'Unknown Downtime', fmt: (r) => minutesLabel(r.unknownDowntimeMin) },
  {
    key: 'idealCycleTimeSeconds',
    label: 'Ideal Cycle Time',
    fmt: (r) => (r.idealCycleTimeSeconds == null ? '' : `${r.idealCycleTimeSeconds.toFixed(0)} secs`),
  },
  {
    key: 'actualCycleTimeSeconds',
    label: 'Actual Cycle Time',
    fmt: (r) => (r.actualCycleTimeSeconds == null ? '' : `${(r.actualCycleTimeSeconds / 60).toFixed(1)} mins`),
  },
];

function minutesLabel(min: number): string {
  return `${min.toFixed(1)} mins`;
}

export default function HourlyTable({ columns, rows }: HourlyTableProps) {
  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
        Hourly Production &amp; Downtime Summary
      </Typography>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, minWidth: 160 }}>Param</TableCell>
              {columns.map((col) => (
                <TableCell key={col.label} align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ROW_DEFS.map((rowDef) => (
              <TableRow key={rowDef.key}>
                <TableCell sx={{ fontWeight: 500 }}>{rowDef.label}</TableCell>
                {rows.map((row, idx) => (
                  <TableCell key={idx} align="right">
                    {row.isFuture ? '' : rowDef.fmt(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
