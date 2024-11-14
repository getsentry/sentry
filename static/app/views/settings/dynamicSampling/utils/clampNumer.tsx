function clampNumber(number: number, min: number, max: number) {
  return Math.min(Math.max(number, min), max);
}

export function clampPercentRate(number: number) {
  return clampNumber(number, 0, 1);
}
