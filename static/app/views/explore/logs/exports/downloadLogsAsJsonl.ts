import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {createLogDownloadFilename} from 'sentry/views/explore/logs/createLogDownloadFilename';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';

export function downloadLogsAsJsonl(rows: OurLogsResponseItem[], filename: string) {
  const jsonlContent = rows.map(row => JSON.stringify(row)).join('\n');
  const encodedDataUrl = `data:application/jsonl;charset=utf8,${encodeURIComponent(jsonlContent)}`;

  downloadFromHref(createLogDownloadFilename(filename, 'jsonl'), encodedDataUrl);
}
