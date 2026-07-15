import {downloadAsJsonl} from 'sentry/components/exports/downloadAsJsonl';
import type {DataExportFormat} from 'sentry/components/exports/useDataExport';
import {downloadLogsAsCsv} from 'sentry/views/explore/logs/exports/downloadLogsAsCsv';
import type {
  OurLogsAggregateResponseItem,
  OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';

export type ExportableLogRow = OurLogsResponseItem | OurLogsAggregateResponseItem;

interface DownloadLogsOptions {
  fields: string[];
  filename: string;
  format: DataExportFormat;
  rows: ExportableLogRow[];
}

export function downloadLogs({fields, filename, format, rows}: DownloadLogsOptions) {
  switch (format) {
    case 'csv':
      return downloadLogsAsCsv(rows, fields, filename);
    case 'jsonl':
      return downloadAsJsonl(rows, filename);
  }
}
