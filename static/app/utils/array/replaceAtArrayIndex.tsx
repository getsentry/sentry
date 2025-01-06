/**
 * Replace item at `index` in `array` with `obj` without mutating `array`
 */
export default function replaceAtArrayIndex<T>(
  array: Readonly<T[]>,
  index: number,
  obj: T
): T[] {
  return array.toSpliced(index, 1, obj);
}
