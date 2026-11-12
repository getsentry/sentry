export function toSplicedSorted<T>(
  items: readonly T[],
  item: T,
  comparator: (a: T, b: T) => number
) {
  const insertionIndex = items.findIndex(original => comparator(original, item) > 0);

  return insertionIndex === -1
    ? [...items, item]
    : [...items.slice(0, insertionIndex), item, ...items.slice(insertionIndex)];
}
