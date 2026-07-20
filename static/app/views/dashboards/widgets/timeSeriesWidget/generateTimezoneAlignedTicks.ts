import moment from 'moment-timezone';

import {DAY, HOUR, MINUTE, SECOND} from 'sentry/utils/formatters';

type TimeAxisUnit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

/**
 * Generate timezone-aligned tick positions for an ECharts time axis.
 *
 * ECharts can only place ticks at browser-local or UTC round boundaries.
 * When the user's configured timezone differs from the browser timezone,
 * ticks appear at non-round times (e.g., every tick at "9:30 PM" instead
 * of "12:00 AM"). This function computes tick positions at round boundaries
 * in the user's timezone, for use with ECharts' `customValues` option on
 * both `axisTick` and `axisLabel`.
 *
 * Unlike ECharts' built-in multi-level tick generation (which builds a
 * hierarchy of year → month → day → hour ticks and assigns each a `level`
 * for formatting), this uses a simpler flat, single-pass approach: pick one
 * (unit, step) interval, snap to the nearest round boundary, and walk
 * forward. This works because label formatting is handled separately by
 * {@link formatXAxisTimestamp}, which inspects each tick value and cascades
 * through format levels based on what round boundary it falls on (e.g., a
 * tick at midnight Jan 1 gets "2025", a tick at midnight gets
 * "Feb 3rd", a tick at 2:00 PM gets "2:00 PM"). The combination of flat
 * tick generation + cascading formatter produces the same mixed-granularity
 * labels as ECharts' hierarchy (e.g., "2025 | Feb | Mar | Apr").
 *
 * @param startMs  Start of the time range (UTC milliseconds)
 * @param endMs    End of the time range (UTC milliseconds)
 * @param splitNumber  Desired number of ticks (approximate)
 * @param userTimezone  The user's configured Sentry timezone (IANA string,
 *   e.g. 'America/New_York'). Pass 'UTC' when the page filter has UTC enabled.
 * @returns Array of UTC millisecond timestamps for tick positions
 */
export function generateTimezoneAlignedTicks(
  startMs: number,
  endMs: number,
  splitNumber: number,
  userTimezone: string
): number[] {
  if (endMs <= startMs || splitNumber <= 0) {
    return [];
  }

  const interval = pickInterval(startMs, endMs, splitNumber);
  const currentTick = snapToRoundBoundary(
    startMs,
    interval.unit,
    interval.step,
    userTimezone
  );

  // Walk forward from the snapped boundary, collecting only ticks that fall
  // within the data range [startMs, endMs].
  const ticks: number[] = [];
  while (currentTick.valueOf() <= endMs) {
    if (currentTick.valueOf() >= startMs) {
      ticks.push(currentTick.valueOf());
    }
    currentTick.add(interval.step, interval.unit);
  }

  return ticks;
}

/**
 * Nominal durations in milliseconds for each time unit. Month and year use
 * approximate values (30d, 365d) since exact durations vary — this is only
 * used for picking the right order-of-magnitude interval, not for precise
 * arithmetic.
 */
const AXIS_UNIT_DURATIONS: Record<TimeAxisUnit, number> = {
  second: SECOND,
  minute: MINUTE,
  hour: HOUR,
  day: DAY,
  month: 30 * DAY,
  year: 365 * DAY,
};

/**
 * A table of candidate tick intervals, mirroring ECharts' own
 * `scaleIntervals` (echarts/src/scale/Time.ts:281-306). Each entry defines
 * a time unit and the "round" step sizes allowed for that unit. For example,
 * `{unit: 'hour', steps: [1, 2, 4, 6, 12]}` means we might place ticks
 * every 1, 2, 4, 6, or 12 hours. These specific multiples are chosen
 * because they produce the "clock-friendly" labels people expect to see
 * (e.g., 12:00, 4:00, 8:00 rather than 5:00, 10:00, 15:00, 20:00).
 *
 * {@link pickInterval} flattens this into duration-sorted (unit, step)
 * pairs and picks the smallest one whose duration exceeds the approximate
 * per-tick interval for the given time range and desired tick count.
 */
const INTERVAL_LEVELS: Array<{steps: number[]; unit: TimeAxisUnit}> = [
  {unit: 'second', steps: [1, 2, 5, 10, 15, 20, 30]},
  {unit: 'minute', steps: [1, 2, 5, 10, 15, 20, 30]},
  {unit: 'hour', steps: [1, 2, 4, 6, 12]},
  {unit: 'day', steps: [1, 2, 4, 7, 16]},
  {unit: 'month', steps: [1, 2, 3, 6]},
  {unit: 'year', steps: [1]},
];

type TickInterval = {duration: number; step: number; unit: TimeAxisUnit};

/**
 * Flattened and sorted list of all (unit, step) pairs with their
 * durations, for efficient interval selection.
 *
 * Example entries after flattening and sorting:
 *   {unit: 'second', step: 1, duration: 1000}
 *   {unit: 'second', step: 2, duration: 2000}
 *   ...
 *   {unit: 'minute', step: 1, duration: 60000}
 *   ...
 *   {unit: 'hour',   step: 1, duration: 3600000}
 *   {unit: 'hour',   step: 2, duration: 7200000}
 *   ...
 */
const SORTED_INTERVALS: TickInterval[] = INTERVAL_LEVELS.flatMap(({unit, steps}) =>
  steps.map(step => ({
    unit,
    step,
    duration: AXIS_UNIT_DURATIONS[unit] * step,
  }))
).sort((a, b) => a.duration - b.duration);

/**
 * Pick the best (unit, step) interval for a given time range and desired
 * number of ticks. Divides the range by the desired tick count to get an
 * approximate per-tick duration, then walks the duration-sorted
 * {@link SORTED_INTERVALS} list and returns the first entry whose duration
 * meets or exceeds that target.
 */
function pickInterval(
  startMs: number,
  endMs: number,
  splitNumber: number
): {step: number; unit: TimeAxisUnit} {
  const approxInterval = (endMs - startMs) / splitNumber;

  for (const {unit, step} of SORTED_INTERVALS) {
    if (AXIS_UNIT_DURATIONS[unit] * step >= approxInterval) {
      return {unit, step};
    }
  }

  return {unit: 'year', step: 1};
}

/**
 * Floor a timestamp to the nearest round boundary for the given unit and
 * step, in the user's timezone. This gives the tick walk a clean starting
 * point that falls on a "round" value.
 *
 * `step` is the interval multiplier from {@link INTERVAL_LEVELS} — e.g.,
 * if the chosen interval is `(hour, 4)`, `step` is `4` meaning "every 4th
 * hour." The snap floors the component to the nearest multiple of `step`:
 * hour 14 → `floor(14/4)*4 = 12`, so 14:30 IST snaps to 12:00 IST.
 */
function snapToRoundBoundary(
  ms: number,
  unit: TimeAxisUnit,
  step: number,
  timezone: string
): moment.Moment {
  const m = moment.tz(ms, timezone);

  switch (unit) {
    case 'year':
      m.year(Math.floor(m.year() / step) * step).startOf('year');
      break;
    case 'month':
      m.month(Math.floor(m.month() / step) * step)
        .date(1)
        .startOf('day');
      break;
    case 'day': {
      const snappedDate = Math.floor((m.date() - 1) / step) * step + 1;
      m.date(snappedDate).startOf('day');
      break;
    }
    case 'hour':
      m.hour(Math.floor(m.hour() / step) * step)
        .minute(0)
        .second(0)
        .millisecond(0);
      break;
    case 'minute':
      m.minute(Math.floor(m.minute() / step) * step)
        .second(0)
        .millisecond(0);
      break;
    case 'second':
      m.second(Math.floor(m.second() / step) * step).millisecond(0);
      break;
    default:
      break;
  }

  return m;
}
