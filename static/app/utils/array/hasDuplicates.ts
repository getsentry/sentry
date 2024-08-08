/**
 * Determines whether the provided array contains any duplicate elements.
 * Returns `true` if there are duplicates, and `false` if all elements are unique.
 *
 * @param array - The array to be checked for duplicates.
 * @returns `boolean` - `true` if duplicates are found; otherwise `false`.
 */
export function hasDuplicates<T = unknown>(array: T[]): boolean {
  const seen = new Set();
  for (const item of array) {
    if (seen.has(item)) {
      return true; // Duplicate found
    }
    seen.add(item);
  }
  return false; // No duplicates
}
