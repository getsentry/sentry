type NonEmptyArray<T> = [T, ...T[]];

/**
 * Allows TypeScript to infer that arrays have at least one item so that
 * expressions like `array[0]` typecheck naturally without needed non-null
 * assertions. Unfortunately heavily limited to only work with `[0]` and not
 * `.at(0)` or any other index.
 */
export function isNonEmptyArray<T>(array: T[]): array is NonEmptyArray<T> {
  return array.length > 0;
}
