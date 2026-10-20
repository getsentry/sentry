export function withUnits(value: string | number): string {
  return typeof value === 'number' ? `${value}px` : value;
}

export function minCssLength(
  first: string | number | undefined,
  second: string | number | undefined
): string | number | undefined {
  if (first === undefined) {
    return second;
  }
  if (second === undefined) {
    return first;
  }
  return `min(${withUnits(first)}, ${withUnits(second)})`;
}
