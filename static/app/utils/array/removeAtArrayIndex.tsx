/**
 * Remove item at `index` in `array` without mutating `array`
 */
export default function removeAtArrayIndex<T>(array: readonly T[], index: number): T[] {
  return array.toSpliced(index, 1);
}
