import {downloadRows, type ExportableRow} from 'sentry/components/exports/downloadRows';
import {ExportQueryType} from 'sentry/components/exports/useDataExport';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreExportModalButton} from 'sentry/views/explore/components/exports/exploreExportModalButton';
import {trackExploreTableExported} from 'sentry/views/explore/components/exports/trackExploreTableExported';
import type {ExploreExportConfig} from 'sentry/views/explore/components/exports/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

export interface MetricsQueryInfo {
  dataset: TraceItemDataset.TRACEMETRICS;
  field: string[];
  project: number[];
  query: string;
  sort: string[];
  end?: string;
  environment?: string[];
  start?: string;
  statsPeriod?: string;
}

type MetricsExportModalButtonProps = {
  estimatedRowCount: number;
  isError: boolean;
  isLoading: boolean;
  queryInfo: MetricsQueryInfo;
  tableData: ExportableRow[];
  title: string;
};

export function useMetricsQueryInfo({
  field,
  query,
  sort,
}: {
  field: string[];
  query: string;
  sort: string[];
}): MetricsQueryInfo {
  const {selection} = usePageFilters();
  const {start, end, period: statsPeriod} = selection.datetime;
  const {environments, projects} = selection;

  return {
    dataset: TraceItemDataset.TRACEMETRICS,
    field,
    query,
    project: projects,
    sort,
    start: start ? new Date(start).toISOString() : undefined,
    end: end ? new Date(end).toISOString() : undefined,
    statsPeriod: statsPeriod || undefined,
    environment: environments,
  };
}

export function MetricsExportModalButton({
  estimatedRowCount,
  isError,
  isLoading,
  queryInfo,
  tableData,
  title,
}: MetricsExportModalButtonProps) {
  const organization = useOrganization();

  const filenameBase = 'metrics';

  const config: ExploreExportConfig = {
    title,
    filenameBase,
    queryInfo,
    asyncQueryType: ExportQueryType.EXPLORE,
    supportsAllColumns: false,
    availableFormats: ['csv', 'jsonl'],
    estimatedRowCount,
    localRowCount: tableData.length,
    localDownload: ({format, limit}) =>
      downloadRows({
        rows: tableData.slice(0, limit),
        fields: queryInfo.field,
        filename: filenameBase,
        format,
      }),
    trackExportSubmit: args =>
      trackExploreTableExported({
        ...args,
        organization,
        traceItemDataset: TraceItemDataset.TRACEMETRICS,
        queryInfo,
      }),
  };

  return (
    <ExploreExportModalButton
      config={config}
      isDataEmpty={!tableData.length}
      isDataError={isError}
      isDataLoading={isLoading}
      onOpen={() =>
        trackAnalytics('metrics.export_modal', {organization, action: 'open'})
      }
      onClose={reason =>
        trackAnalytics('metrics.export_modal', {
          organization,
          action: 'cancel',
          close_reason: reason,
        })
      }
    />
  );
}
