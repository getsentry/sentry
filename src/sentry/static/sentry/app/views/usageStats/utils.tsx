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
 * This expects usage values/quantities for the data categories that we sell.
 *
 * Note: usageQuantity for Attachments should be in BYTES
 */
export function formatUsageWithUnits(
  usageQuantity: number = 0,
  dataCategory: DataCategory,
  options: FormatOptions = {isAbbreviated: false, useUnitScaling: false}
) {
  if (dataCategory !== DataCategory.ATTACHMENT) {
    return options.isAbbreviated
      ? abbreviateUsageNumber(usageQuantity)
      : usageQuantity.toLocaleString();
  }

  if (options.useUnitScaling) {
    return formatBytesBase10(usageQuantity);
  }

  const usageGb = usageQuantity / GIGABYTE;
  return options.isAbbreviated
    ? `${abbreviateUsageNumber(usageGb)} GB`
    : `${usageGb.toLocaleString(undefined, {maximumFractionDigits: 2})} GB`;
}

/**
 * Instead of using this function directly, use formatReservedWithUnits or
 * formatUsageWithUnits with options.isAbbreviated to true instead.
 *
 * This function display different precision for billion/million/thousand to
 * provide clarity on usage of errors/transactions/attachments to the user.
 *
 * If you are not displaying usage numbers, it might be better to use
 * `formatAbbreviatedNumber` in 'app/utils/formatters'
 */
export function abbreviateUsageNumber(n: number) {
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
