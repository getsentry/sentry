/**
 * Rounds to specified number of decimal digits (defaults to 2) without forcing trailing zeros
 * Will preserve significant decimals for very small numbers
 * e.g. 0.0001234 -> 0.00012
 * @param value number to format
 */
export function formatNumberWithDynamicDecimalPoints(
  value: number,
  maxFractionDigits = 2
): string {
  if (!Number.isFinite(value)) {
    if (value === Infinity) return '∞';
    if (value === -Infinity) return '-∞';
    return 'NaN';
  }

  if (value === 0) return '0';

  const exponent = Math.floor(Math.log10(Math.abs(value)));

  const maximumFractionDigits =
    exponent >= 0 ? maxFractionDigits : Math.abs(exponent) + 1;

  // Compute a factor for rounding to the desired decimal place
  const factor = 10 ** maximumFractionDigits;

  // Determine the sign of the number: 1 = positive, -1 = negative, 0 = zero
  const valueSign = Math.sign(value);

  // Round the number, adding a small epsilon in the direction of the sign
  // This fixes floating-point rounding issues for numbers like 1.005 or -1.005
  const roundedNumber =
    Math.round((value + valueSign * Number.EPSILON) * factor) / factor;

  return roundedNumber.toFixed(maximumFractionDigits).replace(/\.?0+$/, '');
}
