import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {unparseCsv} from 'sentry/utils/unparseCsv';

import {createExportFilename} from './createExportFilename';
import type {ExportableRow} from './downloadRows';

export function downloadRowsAsCsv(
  rows: ExportableRow[],
  fields: string[],
  filename: string
) {
  const headings = fields.map(field => field);
  const keys = fields;

  const csvContent = unparseCsv({
    fields: headings,
    data: rows.map(row =>
      keys.map(key => {
        return (row as Record<string, string | number>)[key];
      })
    ),
  });

  const encodedDataUrl = `data:text/csv;charset=utf8,${encodeURIComponent(csvContent)}`;

  downloadFromHref(createExportFilename(filename, 'csv'), encodedDataUrl);
}
