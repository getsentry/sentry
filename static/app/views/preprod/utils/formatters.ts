/**
 * Safely formats percentages with proper precision and Unicode minus sign
 */
export function formatPercentage(percentage: number): string {
  if (!isFinite(percentage) || isNaN(percentage)) {
    return '0.0%';
  }

  const sign = percentage < 0 ? '−' : '';
  const absPercentage = Math.abs(percentage);

  if (absPercentage >= 0.1) {
    return `${sign}${absPercentage.toFixed(1)}%`;
  }
  return `${sign}${absPercentage.toFixed(2)}%`;
}
