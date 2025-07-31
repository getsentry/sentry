import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';

/**
 * Safely formats savings amounts with proper sign handling
 */
export function formatSavingsAmount(savings: number): string {
  if (!isFinite(savings) || isNaN(savings)) {
    return '0 B';
  }

  if (savings === 0) {
    return '0 B';
  }

  const sign = savings < 0 ? '−' : '';
  const absoluteSavings = Math.abs(savings);

  return `${sign}${formatBytesBase10(absoluteSavings)}`;
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
