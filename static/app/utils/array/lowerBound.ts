/**
 * Returns first index of value in array where value.end < target
 * Example: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], target = 5, returns 3 which points to value 4
 * @param target {number}
 * @param values {Array<T> | ReadonlyArray<T>}
 * @returns number
 */
export function lowerBound<T extends {end: number; start: number}>(
  target: number,
  values: T[] | readonly T[]
): number;
export function lowerBound<T>(
  target: number,
  values: T[] | readonly T[],
  getValue: (value: T) => number
): number;
export function lowerBound<T extends {end: number; start: number}>(
  target: number,
  values: T[] | readonly T[],
  getValue?: (value: T) => number
): number {
  let low = 0;
  let high = values.length;

  if (high === 0) {
    return 0;
  }

  if (high === 1) {
    return getValue
      ? getValue(values[0]!) < target
        ? 1
        : 0
      : values[0]!.end < target
        ? 1
        : 0;
  }

  while (low !== high) {
    const mid = low + Math.floor((high - low) / 2);
    const value = getValue ? getValue(values[mid]!) : values[mid]!.end;

    if (value < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}
