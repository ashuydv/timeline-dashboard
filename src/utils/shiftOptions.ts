import type { Shift } from '../types/api';
import { resolveShiftWindow } from './time';

export interface ShiftOption {
  shiftId: string;
  shiftName: string;
  startHHMM: string;
  endHHMM: string;
  crossesMidnight: boolean;
  label: string; // e.g. "main (00:30 - 12:30)"
}

/** Expand each shift's shift_timings into individually-selectable shift-window options. */
export function buildShiftOptions(shifts: Shift[]): ShiftOption[] {
  const options: ShiftOption[] = [];
  for (const shift of shifts) {
    for (const start of shift.shift_timings) {
      const { startHHMM, endHHMM, crossesMidnight } = resolveShiftWindow(shift.shift_timings, start);
      options.push({
        shiftId: shift.id,
        shiftName: shift.name,
        startHHMM,
        endHHMM,
        crossesMidnight,
        label: `${shift.name} (${startHHMM} - ${endHHMM})`,
      });
    }
  }
  return options;
}

export function shiftOptionKey(opt: ShiftOption): string {
  return `${opt.shiftId}__${opt.startHHMM}`;
}
