import Papa from 'papaparse';

import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import type {DiffItem} from 'sentry/views/preprod/types/appSizeTypes';

function disableMacros(value: string | null | boolean | number | undefined) {
  if (
    typeof value === 'string' &&
    (value.charAt(0) === '=' ||
      value.charAt(0) === '+' ||
      value.charAt(0) === '-' ||
      value.charAt(0) === '@')
  ) {
    return `'${value}`;
  }
  return value ?? '';
}

export function downloadSizeCompareItemsAsCsv(diffItems: DiffItem[], filename: string) {
  const csvContent = Papa.unparse({
    fields: ['Change', 'File Path', 'Item Type', 'Size (bytes)', 'Size Diff (bytes)'],
    data: diffItems.map(item => [
      disableMacros(item.type),
      disableMacros(item.path),
      disableMacros(item.item_type ?? ''),
      item.head_size ?? item.base_size ?? '',
      item.size_diff,
    ]),
  });

  const encodedDataUrl = `data:text/csv;charset=utf8,${encodeURIComponent(csvContent)}`;

  downloadFromHref(`${filename}.csv`, encodedDataUrl);
}
