/**
 * Replace item at `index` in `array` with `obj` without mutating `array`
 */
export function replaceAtArrayIndex<T>(array: readonly T[], index: number, obj: T): T[] {
  return array.toSpliced(index, 1, obj);
}
// trivial change for CI testing
