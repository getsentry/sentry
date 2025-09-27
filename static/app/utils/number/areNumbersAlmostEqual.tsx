/**
 * Given two numbers, returns whether they are almost equal to each other. The comparison is based on percentage difference relative to the larger absolute value, rather than the absolute value difference.
 */

export function areNumbersAlmostEqual(
  a: number,
  b: number,
  differenceThresholdPercentage: number = DEFAULT_THRESHOLD
): boolean {
  // Handle exact equality
  if (a === b) {
    return true;
  }

  const diff = Math.abs(a - b);
  const maxAbs = Math.max(Math.abs(a), Math.abs(b));

  // Handle comparison against 0
  if (maxAbs === 0) {
    return true;
  }

  const percentageDiff = (diff / maxAbs) * 100;
  return percentageDiff <= differenceThresholdPercentage;
}

const DEFAULT_THRESHOLD = 0.5; // 0.5% maximum difference
