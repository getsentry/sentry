/**
 * Replace item at `index` in `array` with `obj`
 */
export function replaceAtArrayIndex<T>(array: T[], index: number, obj: T): T[] {
  const newArray = [...array];
  newArray.splice(index, 1, obj);
  return newArray;
}
