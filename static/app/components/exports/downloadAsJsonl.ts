import {createExportFilename} from 'sentry/components/exports/createExportFilename';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';

export function downloadAsJsonl(rows: Array<Record<string, unknown>>, filename: string) {
  const jsonlContent = rows.map(row => JSON.stringify(row)).join('\n');
  const encodedDataUrl = `data:application/jsonl;charset=utf8,${encodeURIComponent(jsonlContent)}`;

  downloadFromHref(createExportFilename(filename, 'jsonl'), encodedDataUrl);
}
