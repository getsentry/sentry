import {formatNumberWithDynamicDecimalPoints} from '../number/formatNumberWithDynamicDecimalPoints';

/**
 * Note the difference between *a-bytes (base 10) vs *i-bytes (base 2), which
 * means that:
 * - 1000 megabytes is equal to 1 gigabyte
 * - 1024 mebibytes is equal to 1 gibibytes
 *
 * We will use base 10 throughout billing for attachments. This function formats
 * quota/usage values for display.
 *
 * For storage/memory/file sizes, please take a look at formatBytesBase2
 */

export function formatBytesBase10(bytes: number, u = 0) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const threshold = 1000;

  while (bytes >= threshold) {
    bytes /= threshold;
    u += 1;
  }

  return formatNumberWithDynamicDecimalPoints(bytes) + ' ' + units[u];
}
