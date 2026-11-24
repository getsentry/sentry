export interface TimeRange {
  end: number;
  start: number;
}

/**
 * Sorts ranges by start and merges any that overlap or touch.
 */
export function mergeTimeRanges(ranges: readonly TimeRange[]): TimeRange[] {
  const merged: TimeRange[] = [];

  for (const range of ranges.toSorted((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({...range});
    }
  }

  return merged;
}
