import {displayPrice} from 'getsentry/views/amCheckout/utils';

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
const formatCurrency = (value: number | string) => {
  const cents = Number(value);
  return `${displayPrice({cents})}`;
};

export default formatCurrency;
