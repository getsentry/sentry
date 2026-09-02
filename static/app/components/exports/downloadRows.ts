import {downloadAsJsonl} from 'sentry/components/exports/downloadAsJsonl';
import {downloadRowsAsCsv} from 'sentry/components/exports/downloadRowsAsCsv';
import type {DataExportFormat} from 'sentry/components/exports/useDataExport';

export type ExportableRow = Record<string, unknown>;

interface DownloadRowsOptions {
  fields: string[];
  filename: string;
  format: DataExportFormat;
  rows: ExportableRow[];
}

export function downloadRows({fields, filename, format, rows}: DownloadRowsOptions) {
  switch (format) {
    case 'csv':
      return downloadRowsAsCsv(rows, fields, filename);
    case 'jsonl':
      return downloadAsJsonl(rows, filename);
  }
}
