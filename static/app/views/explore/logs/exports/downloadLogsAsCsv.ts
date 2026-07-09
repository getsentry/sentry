import Papa from 'papaparse';

import {createExportFilename} from 'sentry/components/exports/createExportFilename';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import type {OurLogFieldKey, OurLogsResponseItem} from 'sentry/views/explore/logs/types';

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

export function downloadLogsAsCsv(
  rows: OurLogsResponseItem[],
  fields: OurLogFieldKey[],
  filename: string
) {
  const headings = fields.map(field => field);
  const keys = fields;

  const csvContent = Papa.unparse({
    fields: headings,
    data: rows.map((row: OurLogsResponseItem) =>
      keys.map((key: OurLogFieldKey) => {
        return disableMacros(row[key]);
      })
    ),
  });

  const encodedDataUrl = `data:text/csv;charset=utf8,${encodeURIComponent(csvContent)}`;

  downloadFromHref(createExportFilename(filename, 'csv'), encodedDataUrl);
}
