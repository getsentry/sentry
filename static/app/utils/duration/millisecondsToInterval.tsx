import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';

/**
 * A list of valid interval durations in milliseconds corresponding to the interval strings.
 * These values are copied from VALID_GRANULARITIES in src/sentry/search/eap/constants.py
 * and _VALID_GRANULARITY_SECS in snuba (snuba/web/rpc/v1/endpoint_time_series.py).
 */
const VALID_INTERVALS = [
  [15 * 1000, '15s'],
  [30 * 1000, '30s'],
  [60 * 1000, '1m'],
  [2 * 60 * 1000, '2m'],
  [5 * 60 * 1000, '5m'],
  [10 * 60 * 1000, '10m'],
  [15 * 60 * 1000, '15m'],
  [30 * 60 * 1000, '30m'],
  [1 * 3600 * 1000, '1h'],
  [2 * 3600 * 1000, '2h'],
  [3 * 3600 * 1000, '3h'],
  [4 * 3600 * 1000, '4h'],
  [6 * 3600 * 1000, '6h'],
  [12 * 3600 * 1000, '12h'],
  [24 * 3600 * 1000, '1d'],
] as const;

type MillisecondsToClosestIntervalOptions = {
  availableIntervals?: Array<{label: string; value: string}>;
  useNextInterval?: boolean;
};

/**
 * Converts a millisecond value to the closest valid interval string.
 * If the milliseconds value is not one of the exact valid interval durations,
 * it will return the closest valid interval string.
 */
export function millisecondsToClosestInterval(
  ms: number,
  options?: MillisecondsToClosestIntervalOptions
): string | undefined {
  if (ms <= 0 || !Number.isFinite(ms)) {
    return undefined;
  }
  if (ms < VALID_INTERVALS[0][0]) {
    if (options?.availableIntervals) {
      return options.availableIntervals[0]?.value;
    }
    return VALID_INTERVALS[0][1];
  }
  if (ms >= VALID_INTERVALS[VALID_INTERVALS.length - 1]![0]) {
    if (options?.availableIntervals) {
      return options.availableIntervals[options.availableIntervals.length - 1]?.value;
    }
    return VALID_INTERVALS[VALID_INTERVALS.length - 1]![1];
  }

  // Find the interval duration that is closest to ms
  let closestInterval = options?.availableIntervals
    ? options.availableIntervals[0]?.value
    : VALID_INTERVALS[0][1];
  const closestIntervalDurationMs = intervalToMilliseconds(closestInterval!);
  let smallestDiff = Math.abs(ms - closestIntervalDurationMs);

  for (const [intervalDurationInMs, interval] of VALID_INTERVALS) {
    // want to make sure the interval available in the options presented if needed
    if (options?.availableIntervals) {
      if (
        !options.availableIntervals.some(
          availableInterval => availableInterval.value === interval
        )
      ) {
        continue;
      }
    }

    // use the next biggest interval instead of the closest one in case we want to default to a larger interval
    if (options?.useNextInterval) {
      if (intervalDurationInMs >= ms) {
        return interval;
      }
    }

    const diff = Math.abs(ms - intervalDurationInMs);
    if (diff <= smallestDiff) {
      smallestDiff = diff;
      closestInterval = interval;
    }
  }
  return closestInterval;
}
