/**
 * Returns unique values of the given array.
 */
export function uniq<T = unknown>(items: T[] | undefined): T[] {
  return [...new Set(items)];
}
