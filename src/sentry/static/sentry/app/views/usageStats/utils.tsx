import {DataCategory} from 'app/types';

export const MILLION = 10 ** 6;
export const BILLION = 10 ** 9;
export const UNLIMITED = '∞';

export const GIGABYTE = 10 ** 9;

type formatOptions = {
  isAbbreviated?: boolean;
  useUnitScaling?: boolean;
};

/**
 * This expects values from CustomerUsageEndpoint, which contains usage
 * quantities for the data categories that we sell.
 *
 * Note: usageQuantity for Attachments should be in BYTES
 */
export function formatUsageWithUnits(
  usageQuantity: number = 0,
  dataCategory: DataCategory,
  options: formatOptions = {isAbbreviated: false, useUnitScaling: false}
) {
  if (dataCategory !== DataCategory.ATTACHMENTS) {
    return options.isAbbreviated
      ? _displayNumber(usageQuantity)
      : usageQuantity.toLocaleString();
  }

  if (options.useUnitScaling) {
    return _formatAttachmentUnits(usageQuantity);
  }

  const usageGb = usageQuantity / GIGABYTE;
  return options.isAbbreviated
    ? `${_displayNumber(usageGb)} GB`
    : `${usageGb.toLocaleString(undefined, {maximumFractionDigits: 2})} GB`;
}

/**
 * Do not use! Exporting only for re-use getsentry.
 * Use formatReservedWithUnits or formatUsageWithUnits instead.
 *
 * This function is different from sentry/utils/formatBytes. Note the
 * difference between *a-bytes (base 10) vs *i-bytes (base 2), which means that:
 * - 1000 megabytes is equal to 1 gigabyte
 * - 1024 mebibytes is equal to 1024 gibibytes
 *
 * We will use base 10 throughout billing for attachments. This function formats
 * quota/usage values for display.
 *
 * For storage/memory/file sizes, please take a look at the function in
 * sentry/utils/formatBytes.
 */
export function _formatAttachmentUnits(bytes: number, u: number = 0) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const threshold = 1000;

  while (bytes >= threshold) {
    bytes /= threshold;
    u += 1;
  }

  return bytes.toLocaleString(undefined, {maximumFractionDigits: 2}) + ' ' + units[u];
}

/**
 * Do not use! Exporting only for re-use getsentry.
 * Use formatReservedWithUnits or formatUsageWithUnits with options.isAbbreviated to true
 */
export function _displayNumber(n: number) {
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
