import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {unparseCsv} from 'sentry/utils/unparseCsv';
import type {DiffItem} from 'sentry/views/preprod/types/appSizeTypes';

const CSV_ROW_LIMIT = 10_000;

export function downloadSizeCompareItemsAsCsv(diffItems: DiffItem[], filename: string) {
  const rows = diffItems.slice(0, CSV_ROW_LIMIT);
  const csvContent = unparseCsv({
    fields: ['Change', 'File Path', 'Item Type', 'Size (bytes)', 'Size Diff (bytes)'],
    data: rows.map(item => [
      item.type,
      item.path,
      item.item_type ?? '',
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
