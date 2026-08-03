import type {DataExportFormat} from 'sentry/components/exports/useDataExport';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TraceItemDataset} from 'sentry/views/explore/types';

interface ExportedQueryInfo {
  end?: string;
  environment?: string[];
  field?: string[];
  project?: number[];
  query?: string;
  sort?: string | string[];
  start?: string;
  statsPeriod?: string;
}

interface TrackExploreTableExportedOptions {
  exportType: 'browser_sync' | 'export_download';
  format: DataExportFormat;
  isAllColumns: boolean;
  limit: number;
  organization: Organization;
  queryInfo: ExportedQueryInfo;
  traceItemDataset: TraceItemDataset;
}

export function trackExploreTableExported({
  exportType,
  format,
  isAllColumns,
  limit,
  organization,
  queryInfo,
  traceItemDataset,
}: TrackExploreTableExportedOptions) {
  trackAnalytics('explore.table_exported', {
    organization,
    traceItemDataset,
    query: queryInfo.query ?? '',
    sort: Array.isArray(queryInfo.sort)
      ? queryInfo.sort
      : queryInfo.sort
        ? [queryInfo.sort]
        : [],
    project: queryInfo.project,
    environment: queryInfo.environment,
    start: queryInfo.start,
    end: queryInfo.end,
    statsPeriod: queryInfo.statsPeriod,
    field: isAllColumns ? undefined : queryInfo.field,
    export_row_limit: limit,
    export_file_format: format,
    export_type: exportType,
  });
}
