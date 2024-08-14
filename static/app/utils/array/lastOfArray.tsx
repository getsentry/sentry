export function lastOfArray<T extends Array<unknown> | ReadonlyArray<unknown>>(
  t: T
): T[number] {
  return t[t.length - 1];
}
