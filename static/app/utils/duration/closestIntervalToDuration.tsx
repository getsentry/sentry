import {isNonEmptyArray} from 'sentry/utils/array/isNonEmptyArray';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {RangeMap, type Range} from 'sentry/utils/number/rangeMap';

/**
 * Converts a millisecond value to the closest valid interval string.
 * If the milliseconds value is not one of the exact valid interval durations,
 * it will return the closest valid interval string (based on rounding rules).
 */
export function closestIntervalToDuration(
  duration: number,
  availableIntervals: string[]
): string | null {
  if (!isNonEmptyArray(availableIntervals)) {
    return null;
  }

  const sortedIntervals = availableIntervals.sort(
    (a, b) => intervalToMilliseconds(a) - intervalToMilliseconds(b)
  );

  const shortestIntervalDuration = intervalToMilliseconds(sortedIntervals.at(0)!);
  if (duration <= shortestIntervalDuration) {
    // TypeScript correctly unpacks the tuple syntax here, so it knows that
    // `[0]` must be defined. `.at(0)` doesn't have that benefit
    return sortedIntervals[0];
  }

  const longestIntervalDuration = intervalToMilliseconds(sortedIntervals.at(-1)!);
  if (duration >= longestIntervalDuration) {
    // Due to how `noUncheckedIndexedAccess` works, TypeScript here doesn't know
    // that the last element _also_ must exist. The non-null assertion is not
    // avoidable
    return sortedIntervals.at(-1)!;
  }

  if (!Number.isFinite(duration)) {
    return null;
  }

  // Calculate the MIDPOINT value ranges to allow the interval to be chosen.
  // For example if the available intervals are [1m, 5m, 1h, 4h, 6h, 1d], the valid interval range
  // boundaries would be the numbers exactly in between the intervals.
  // so for example:
  // - anything from 0 -> 3m would give the 1m interval,
  // - anything from 3m -> 32.5m would give the 5m interval (because it's closer to 5m than to 1h),
  // - anything from 32.5m -> 2.5h would give the 1h interval,
  // - anything from 2.5h -> 5h would give the 4h interval,
  // - anything from 5h -> 12h would give the 6h interval,
  // - anything from 12h -> Infinity would give the 1d interval,
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
      // Max value should cover up until the value that is considered "closest" to the interval.
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
      // Last interval should cover all values close to and greater than the last interval
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
  const closestInterval = intervalRangeMap.get(duration)!;

  return closestInterval;
}
