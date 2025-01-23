import orderBy from 'lodash/orderBy';

export type Range<T> = {
  max: number;
  min: number;
  value: T;
};

/**
 * Maps a set of integer ranges to the corresponding values.
 *
 * @example
 * ```javascript
 * // Map plan price to support tier
 * const teamSizeToSupportTierMap = new RangeMap([
 *   {min: 0, max: 10, value: 'basic'},
 *   {min: 10, max: 30, value: 'premium'},
 *   {min: 30, max: 50, value: 'ultra-premium'},
 * ]);
 *
 * const quota = quotaToTierMap.get(0); // Tier for small teams is "basic"
 * const quota = quotaToTierMap.get(12); // Tier for a 10-30 person team is "premium"
 * ```
 */
export class RangeMap<T> {
  ranges: Range<T>[];

  constructor(ranges: Range<T>[]) {
    // Filter out sparse array slots just in case
    const filteredRanges = ranges.filter(Boolean);

    if (filteredRanges.length === 0) {
      throw new Error('No ranges provided');
    }

    const sortedRanges = orderBy(filteredRanges, range => range.min, 'asc');

    for (let i = 1; i < sortedRanges.length; i += 1) {
      const previousRange = sortedRanges[i - 1]!;
      const range = sortedRanges[i]!;

      if (previousRange.max > range.min) {
        throw new Error(
          `${rangeToString(range)} overlaps with ${rangeToString(previousRange)}`
        );
      }
    }

    this.ranges = sortedRanges;
  }

  get(value: number) {
    return this.ranges.find(r => {
      return value >= r.min && value < r.max;
    })?.value;
  }

  get min() {
    return this.ranges.at(0)!.value;
  }

  get max() {
    return this.ranges.at(-1)!.value;
  }
}

function rangeToString(range: Range<any>): string {
  return `Range min:${range.min}, max:${range.max}, value:${range.value}`;
}
