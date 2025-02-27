/**
 * Price looks like 1099, but we want to round up to the nearest dollar
 * 1099 -> 1100
 */
export function roundUpToNearestDollar(amount: number) {
  return Math.ceil(amount / 100) * 100;
}
