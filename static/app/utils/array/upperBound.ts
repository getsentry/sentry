/**
 * Returns first index of value in array where value.start < target
 * Example: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], target = 5, returns 4 which points to value 3
 * @param target {number}
 * @param values {Array<T> | ReadonlyArray<T>}
 * @returns number
 */
export function upperBound<T extends {end: number; start: number}>(
  target: number,
  values: T[] | readonly T[]
): number;
export function upperBound<T>(
  target: number,
  values: T[] | readonly T[],
  getValue: (value: T) => number
): number;
export function upperBound<T extends {end: number; start: number} | {x: number}>(
  target: number,
  values: T[] | readonly T[] | Record<any, any>,
  getValue?: (value: T) => number
) {
  let low = 0;
  let high = values.length;

  if (high === 0) {
    return 0;
  }

  if (high === 1) {
    return getValue
      ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        getValue(values[0]) < target
        ? 1
        : 0
      : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        values[0].start < target
        ? 1
        : 0;
  }

  while (low !== high) {
    const mid = low + Math.floor((high - low) / 2);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const value = getValue ? getValue(values[mid]) : values[mid].start;

    if (value < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}
