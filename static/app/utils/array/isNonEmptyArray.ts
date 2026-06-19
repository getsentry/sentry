type NonEmptyArray<T> = [T, ...T[]];

export function isNonEmptyArray<T>(array: T[]): array is NonEmptyArray<T> {
  return array.length > 0;
}
