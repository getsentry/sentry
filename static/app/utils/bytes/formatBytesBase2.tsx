import {formatNumberWithDynamicDecimalPoints} from '../number/formatNumberWithDynamicDecimalPoints';

/**
 * Note the difference between *a-bytes (base 10) vs *i-bytes (base 2), which
 * means that:
 * - 1000 megabytes is equal to 1 gigabyte
 * - 1024 mebibytes is equal to 1 gibibytes
 *
 * We will use base 2 to display storage/memory/file sizes as that is commonly
 * used by Windows or RAM or CPU cache sizes, and it is more familiar to the user
 *
 * For billing-related code around attachments. please take a look at
 * formatBytesBase10
 */

export function formatBytesBase2(bytes: number, fixPoints: number | false = 1): string {
  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  const thresh = 1024;
  if (bytes < thresh) {
    return (
      (fixPoints === false
        ? formatNumberWithDynamicDecimalPoints(bytes)
        : bytes.toFixed(fixPoints)) + ' B'
    );
  }

  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (bytes >= thresh);
  return (
    (fixPoints === false
      ? formatNumberWithDynamicDecimalPoints(bytes)
      : bytes.toFixed(fixPoints)) +
    ' ' +
    units[u]
  );
}
