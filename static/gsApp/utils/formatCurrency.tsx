import {bigNumFormatter} from 'getsentry/views/spendAllocations/utils';

export const CURRENCY_LOCALE = 'en-US';

/**
 * Includes $, and cents in the price when needed.
 *
 * 100.01 => $100.01
 * 100.00 => $100
 * 100.30 => $100.30
 * -100 => -$100
 */
type DisplayPriceTypes = {
  cents: number;
  formatBigNum?: boolean;
};

export function displayPrice({cents, formatBigNum = false}: DisplayPriceTypes): string {
  const dollars = cents / 100;
  const prefix = dollars >= 0 ? '$' : '-$';

  if (formatBigNum) {
    return prefix + bigNumFormatter(Math.abs(dollars));
  }
  const hasCents = dollars % 1 !== 0;
  if (hasCents) {
    return displayPriceWithCents({cents});
  }
  return prefix + Math.abs(dollars).toLocaleString(CURRENCY_LOCALE);
}

/**
 * Always include $ and cents in the price.
 *
 * $100.01 => $100.01
 * $100.00 => $100.00
 * $100.30 => $100.30
 * -100 => -$100.00
 */
export function displayPriceWithCents({
  cents,
  minimumFractionDigits,
  maximumFractionDigits,
}: {
  cents: number;
  maximumFractionDigits?: number;
  minimumFractionDigits?: number;
}): string {
  const dollars = cents / 100;
  const prefix = dollars >= 0 ? '$' : '-$';

  return (
    prefix +
    Math.abs(dollars).toLocaleString(CURRENCY_LOCALE, {
      minimumFractionDigits: minimumFractionDigits ?? 2,
      maximumFractionDigits: maximumFractionDigits ?? 2,
    })
  );
}

/**
 * Converts from cents to human-readable string
 *
 * 0   => $0
 * 1   => $0.01
 * 50  => $0.50
 * 100 => $1
 * 101 => $1.01
 * 150 => $1.50
 */
export const formatCurrency = (value: number | string) => {
  const cents = Number(value);
  return displayPrice({cents});
};
