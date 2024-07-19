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
  if ([0, Infinity, -Infinity, NaN].includes(value)) {
    return value.toLocaleString();
  }

  const exponent = Math.floor(Math.log10(Math.abs(value)));

  const maximumFractionDigits =
    exponent >= 0 ? maxFractionDigits : Math.abs(exponent) + 1;
  const numberFormat = {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  };

  return value.toLocaleString(undefined, numberFormat);
}
