import Papa from 'papaparse';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
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

const CSV_ROW_LIMIT = 10_000;

export function downloadSizeCompareItemsAsCsv(diffItems: DiffItem[], filename: string) {
  const rows = diffItems.slice(0, CSV_ROW_LIMIT);
  const csvContent = Papa.unparse({
    fields: ['Change', 'File Path', 'Item Type', 'Size (bytes)', 'Size Diff (bytes)'],
    data: rows.map(item => [
      disableMacros(item.type),
      disableMacros(item.path),
      disableMacros(item.item_type ?? ''),
      item.head_size ?? item.base_size ?? '',
      item.size_diff,
    ]),
  });

  const encodedDataUrl = `data:text/csv;charset=utf8,${encodeURIComponent(csvContent)}`;

  downloadFromHref(`${filename}.csv`, encodedDataUrl);

  if (diffItems.length > CSV_ROW_LIMIT) {
    addSuccessMessage(
      t('Downloaded first %s of %s items', CSV_ROW_LIMIT, diffItems.length)
    );
  }
}
