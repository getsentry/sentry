import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {RangeMap, type Range} from 'sentry/utils/number/rangeMap';

/**
 * Converts a millisecond value to the closest valid interval string.
 * If the milliseconds value is not one of the exact valid interval durations,
 * it will return the closest valid interval string (based on rounding rules).
 * @param ms - The milliseconds value to convert.
 * @param availableIntervals - Array of available interval strings (e.g. '1m', '5m', '1h') to choose from.
 * @returns The closest valid interval string.
 */
export function millisecondsToClosestInterval(
  ms: number,
  availableIntervals: string[]
): string | undefined {
  if (ms <= 0 || !Number.isFinite(ms)) {
    return undefined;
  }

  // sort the intervals in ascending order in case they are not in order already
  const sortedIntervals = availableIntervals.sort(
    (a, b) => intervalToMilliseconds(a) - intervalToMilliseconds(b)
  );

  // calculate the MIDPOINT value ranges to allow the interval to be chosen
  const intervalRanges: Array<Range<string>> = [];
  for (let i = 0; i < sortedIntervals.length; i++) {
    const range: Range<string> = {min: 0, max: 0, value: sortedIntervals[i]!};
    if (i < sortedIntervals.length - 1) {
      // min value should cover end of the previous interval (or 0 if there is no previous interval)
      if (i === 0) {
        range.min = 0;
      } else {
        range.min = intervalRanges[i - 1]!.max;
      }
      // max value should cover up until the value that is considered "closest" to the interval.
      // Any value up to halfway between the current and next interval would take the current interval.
      const halfIntervalDifference = Math.round(
        Math.abs(
          intervalToMilliseconds(sortedIntervals[i]!) -
            intervalToMilliseconds(sortedIntervals[i + 1]!)
        ) / 2
      );
      range.max = intervalToMilliseconds(sortedIntervals[i]!) + halfIntervalDifference;
      intervalRanges.push(range);
    } else if (sortedIntervals.length > 1) {
      // last interval should cover all values close to and greater than the last interval
      range.min = intervalRanges[i - 1]?.max ?? 0;
      range.max = Infinity;
      intervalRanges.push(range);
    } else {
      range.min = 0;
      range.max = Infinity;
      intervalRanges.push(range);
    }
  }

  const intervalRangeMap = new RangeMap(intervalRanges ?? []);
  const closestInterval = intervalRangeMap.get(ms);
  return closestInterval;
}
