import {DataCategory} from 'app/types';
import {formatBytesBase10} from 'app/utils';

export const MILLION = 10 ** 6;
export const BILLION = 10 ** 9;

export const GIGABYTE = 10 ** 9;

type FormatOptions = {
  /**
   * Truncate 1234 => 1.2k or 1,234,000 to 1.23M
   */
  isAbbreviated?: boolean;

  /**
   * Convert attachments to use the most appropriate unit KB/MB/GB/TB/etc.
   * Otherwise, it will default to GB
   */
  useUnitScaling?: boolean;
};

/**
 * This expects usage values/quantities for the data categories that we sell and
 * the base unit for it is KB is different from reserved values/quantities
 *
 * Note: usageQuantity for Attachments should be in BYTES
 */
export function formatUsageWithUnits(
  usageQuantity: number = 0,
  dataCategory: DataCategory,
  options: FormatOptions = {isAbbreviated: false, useUnitScaling: false}
) {
  if (dataCategory !== DataCategory.ATTACHMENTS) {
    return options.isAbbreviated
      ? _abbreviateUsageNumber(usageQuantity)
      : usageQuantity.toLocaleString();
  }

  if (options.useUnitScaling) {
    return formatBytesBase10(usageQuantity);
  }

  const usageGb = usageQuantity / GIGABYTE;
  return options.isAbbreviated
    ? `${_abbreviateUsageNumber(usageGb)} GB`
    : `${usageGb.toLocaleString(undefined, {maximumFractionDigits: 2})} GB`;
}

/**
 * Do not use! Exporting only for re-use getsentry.
 * Use formatReservedWithUnits or formatUsageWithUnits with options.isAbbreviated to true
 */
export function _abbreviateUsageNumber(n: number) {
  if (n >= BILLION) {
    return (n / BILLION).toLocaleString(undefined, {maximumFractionDigits: 2}) + 'B';
  }

  if (n >= MILLION) {
    return (n / MILLION).toLocaleString(undefined, {maximumFractionDigits: 1}) + 'M';
  }

  if (n >= 1000) {
    return (n / 1000).toFixed().toLocaleString() + 'K';
  }

  // Do not show decimals
  return n.toFixed().toLocaleString();
}
