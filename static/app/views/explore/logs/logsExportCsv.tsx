import Papa from 'papaparse';

import {getUtcDateString} from 'sentry/utils/dates';
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
  tableData: OurLogsResponseItem[],
  fields: OurLogFieldKey[],
  filename: string
) {
  const headings = fields.map(field => field);
  const keys = fields;

  const csvContent = Papa.unparse({
    fields: headings,
    data: tableData.map((row: OurLogsResponseItem) =>
      keys.map((key: OurLogFieldKey) => {
        return disableMacros(row[key]);
      })
    ),
  });

  const encodedDataUrl = `data:text/csv;charset=utf8,${encodeURIComponent(csvContent)}`;

  const now = new Date();
  emptyClickCSV(encodedDataUrl, filename, now);
}

function emptyClickCSV(encodedDataUrl: string, filename: string, now: Date) {
  const link = document.createElement('a');

  link.setAttribute('href', encodedDataUrl);
  link.setAttribute('download', `${filename} ${getUtcDateString(now)}.csv`);
  link.click();
  link.remove();

  return encodedDataUrl;
}
