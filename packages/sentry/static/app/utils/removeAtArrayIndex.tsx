/**
 * Remove item at `index` in `array` without mutating `array`
 */
export function removeAtArrayIndex<T>(array: T[], index: number): T[] {
  const newArray = [...array];
  newArray.splice(index, 1);
  return newArray;
}
