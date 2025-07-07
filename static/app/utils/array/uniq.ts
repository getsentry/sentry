/**
 * Returns unique values of the given array.
 */
export function uniq<T = unknown>(items: T[] | undefined | null): T[] {
  if (!Array.isArray(items)) {
    return [];
  }
  return [...new Set(items)];
}
