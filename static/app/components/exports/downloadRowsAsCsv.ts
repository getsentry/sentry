import Papa from 'papaparse';

import {createExportFilename} from 'sentry/components/exports/createExportFilename';
import type {ExportableRow} from 'sentry/components/exports/downloadRows';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';

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

export function downloadRowsAsCsv(
  rows: ExportableRow[],
  fields: string[],
  filename: string
) {
  const headings = fields.map(field => field);
  const keys = fields;

  const csvContent = Papa.unparse({
    fields: headings,
    data: rows.map(row =>
      keys.map(key => {
        return disableMacros((row as Record<string, string | number>)[key]);
      })
    ),
  });

  const encodedDataUrl = `data:text/csv;charset=utf8,${encodeURIComponent(csvContent)}`;

  downloadFromHref(createExportFilename(filename, 'csv'), encodedDataUrl);
}
