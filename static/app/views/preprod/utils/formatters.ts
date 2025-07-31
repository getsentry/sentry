import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';

/**
 * Safely formats savings amounts, ensuring valid finite numbers
 */
export function formatSavingsAmount(savings: number): string {
  if (!isFinite(savings) || isNaN(savings) || savings <= 0) {
    return '0 B';
  }
  return formatBytesBase10(savings);
}

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
