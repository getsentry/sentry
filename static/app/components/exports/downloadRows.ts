import {downloadAsJsonl} from './downloadAsJsonl';
import {downloadRowsAsCsv} from './downloadRowsAsCsv';
import type {DataExportFormat} from './useDataExport';

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
