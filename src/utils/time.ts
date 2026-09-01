import { fromZonedTime, toZonedTime, formatInTimeZone } from 'date-fns-tz';

export const IST_TZ = 'Asia/Kolkata';

/** Parse a "HH:MM" string into { h, m }. */
export function parseHHMM(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { h, m };
}

/**
 * Given a shift's ordered start times and the one the user picked, compute the
 * shift's IST start/end as a same-named local wall-clock pair. If end <= start
 * it crosses midnight into the next day.
 */
export function resolveShiftWindow(
  shiftTimings: string[],
  selectedStart: string,
): { startHHMM: string; endHHMM: string; crossesMidnight: boolean } {
  const idx = shiftTimings.indexOf(selectedStart);
  if (idx === -1) throw new Error(`Shift start ${selectedStart} not found in shift_timings`);
  const endHHMM = shiftTimings[(idx + 1) % shiftTimings.length];
  const { h: sh, m: sm } = parseHHMM(selectedStart);
  const { h: eh, m: em } = parseHHMM(endHHMM);
  const crossesMidnight = eh * 60 + em <= sh * 60 + sm;
  return { startHHMM: selectedStart, endHHMM, crossesMidnight };
}

/**
 * Build the UTC time_range for a given IST calendar date (yyyy-MM-dd) + shift window.
 */
export function buildShiftTimeRangeUtc(
  dateYYYYMMDD: string,
  startHHMM: string,
  endHHMM: string,
  crossesMidnight: boolean,
): { from_ts: string; to_ts: string } {
  const { h: sh, m: sm } = parseHHMM(startHHMM);
  const { h: eh, m: em } = parseHHMM(endHHMM);

  const startLocalIso = `${dateYYYYMMDD}T${pad(sh)}:${pad(sm)}:00`;
  const startUtc = fromZonedTime(startLocalIso, IST_TZ);

  const endDate = crossesMidnight ? addDaysToDateString(dateYYYYMMDD, 1) : dateYYYYMMDD;
  const endLocalIso = `${endDate}T${pad(eh)}:${pad(em)}:00`;
  const endUtc = fromZonedTime(endLocalIso, IST_TZ);

  return { from_ts: startUtc.toISOString(), to_ts: endUtc.toISOString() };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function addDaysToDateString(dateYYYYMMDD: string, days: number): string {
  const [y, m, d] = dateYYYYMMDD.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Convert a UTC ISO timestamp to a JS Date representing the same instant (for IST-aware formatting). */
export function utcToDate(utcIso: string): Date {
  return new Date(utcIso);
}

/** Format a UTC ISO timestamp in IST using the given date-fns-tz format string. */
export function formatIst(utcIso: string, fmt: string): string {
  return formatInTimeZone(utcIso, IST_TZ, fmt);
}

/** Get the IST wall-clock hour bucket start (as a UTC Date, hour-aligned in IST) for a UTC timestamp. */
export function istHourBucketStart(utcIso: string): Date {
  const zoned = toZonedTime(utcIso, IST_TZ);
  const bucketLocalIso = `${zoned.getFullYear()}-${pad(zoned.getMonth() + 1)}-${pad(zoned.getDate())}T${pad(
    zoned.getHours(),
  )}:00:00`;
  return fromZonedTime(bucketLocalIso, IST_TZ);
}

/** Current instant, exposed as a function so it's mockable/overridable if ever needed. */
export function now(): Date {
  return new Date();
}
