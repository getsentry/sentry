/** Return the smaller of two CSS heights, treating an omitted height as unlimited. */
export function minHeight(
  first: string | number | undefined,
  second: string | number | undefined
): string | number | undefined {
  if (first === undefined) {
    return second;
  }
  if (second === undefined) {
    return first;
  }
  const firstHeight = typeof first === 'number' ? `${first}px` : first;
  const secondHeight = typeof second === 'number' ? `${second}px` : second;
  return `min(${firstHeight}, ${secondHeight})`;
}
