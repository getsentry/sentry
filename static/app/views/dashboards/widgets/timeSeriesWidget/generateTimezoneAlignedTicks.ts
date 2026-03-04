import * as Sentry from '@sentry/react';
import moment from 'moment-timezone';

type TimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

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
 * @param timezone  IANA timezone string (e.g., 'America/New_York')
 * @returns Array of UTC millisecond timestamps for tick positions
 */
export function generateTimezoneAlignedTicks(
  startMs: number,
  endMs: number,
  splitNumber: number,
  timezone: string
): number[] {
  if (endMs <= startMs || splitNumber <= 0) {
    return [];
  }

  const start = performance.now();

  const {unit, step} = pickInterval(startMs, endMs, splitNumber);
  const cursor = snapToRoundBoundary(startMs, unit, step, timezone);
  const ticks: number[] = [];

  // Safety limit to prevent infinite loops
  const maxIterations = splitNumber * 10;
  let iterations = 0;

  while (cursor.valueOf() <= endMs && iterations < maxIterations) {
    if (cursor.valueOf() >= startMs) {
      ticks.push(cursor.valueOf());
    }
    cursor.add(step, unit);
    iterations++;
  }

  Sentry.metrics.distribution(
    'dashboards.widget.generate_timezone_aligned_ticks',
    performance.now() - start,
    {
      unit: 'millisecond',
      tags: {interval_unit: unit, tick_count: String(ticks.length)},
    }
  );

  return ticks;
}

/**
 * Durations in milliseconds for each time unit. Month and year use nominal
 * values (30d, 365d) since exact durations vary — this is only used for
 * picking the right order-of-magnitude interval, not for precise arithmetic.
 */
const UNIT_DURATIONS: Record<TimeUnit, number> = {
  second: 1000,
  minute: 60 * 1000,
  hour: 3600 * 1000,
  day: 86400 * 1000,
  month: 30 * 86400 * 1000,
  year: 365 * 86400 * 1000,
};

/**
 * Mirrors ECharts' `scaleIntervals` (echarts/src/scale/Time.ts:281-306).
 * Each (unit, step) pair represents a possible tick interval, ordered from
 * finest to coarsest granularity.
 */
const INTERVAL_LEVELS: Array<{steps: number[]; unit: TimeUnit}> = [
  {unit: 'second', steps: [1, 2, 5, 10, 15, 20, 30]},
  {unit: 'minute', steps: [1, 2, 5, 10, 15, 20, 30]},
  {unit: 'hour', steps: [1, 2, 4, 6, 12]},
  {unit: 'day', steps: [1, 2, 4, 7, 16]},
  {unit: 'month', steps: [1, 2, 3, 6]},
  {unit: 'year', steps: [1]},
];

/**
 * Flattened and sorted list of all (unit, step) pairs with their
 * durations, for efficient interval selection.
 */
const SORTED_INTERVALS: Array<{duration: number; step: number; unit: TimeUnit}> =
  INTERVAL_LEVELS.flatMap(({unit, steps}) =>
    steps.map(step => ({
      unit,
      step,
      duration: UNIT_DURATIONS[unit] * step,
    }))
  ).sort((a, b) => a.duration - b.duration);

/**
 * Pick the best (unit, step) interval for a given time range and desired
 * number of ticks.
 */
function pickInterval(
  startMs: number,
  endMs: number,
  splitNumber: number
): {step: number; unit: TimeUnit} {
  const approxInterval = (endMs - startMs) / splitNumber;

  for (const {unit, step} of SORTED_INTERVALS) {
    if (UNIT_DURATIONS[unit] * step >= approxInterval) {
      return {unit, step};
    }
  }

  // Fallback to the coarsest interval (1 year)
  return {unit: 'year', step: 1};
}

/**
 * Snap a timestamp down to the nearest round boundary for the given
 * unit and step, in the specified timezone.
 *
 * For example, with unit='hour' and step=6, a timestamp at 14:30 IST
 * would snap down to 12:00 IST.
 */
function snapToRoundBoundary(
  ms: number,
  unit: TimeUnit,
  step: number,
  timezone: string
): moment.Moment {
  const m = moment.tz(ms, timezone);

  switch (unit) {
    case 'year':
      m.year(Math.floor(m.year() / step) * step)
        .month(0)
        .date(1)
        .startOf('day');
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
