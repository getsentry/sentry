import {type LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {ExportQueryType} from 'sentry/components/exports/useDataExport';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreExportModalButton} from 'sentry/views/explore/components/exports/exploreExportModalButton';
import {trackExploreTableExported} from 'sentry/views/explore/components/exports/trackExploreTableExported';
import type {ExploreExportConfig} from 'sentry/views/explore/components/exports/types';
import {downloadLogs} from 'sentry/views/explore/logs/exports/downloadLogs';
import type {
  OurLogsAggregateResponseItem,
  OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {useQueryParamsSearch} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

type LogsExportModalButtonProps = {
  estimatedRowCount: number;
  isLoading: boolean;
  queryInfo: LogsQueryInfo;
  supportsAllColumns: boolean;
  tableData: Array<OurLogsResponseItem | OurLogsAggregateResponseItem>;
  title: string;
  error?: Error | null;
};

export function formatExportSort(sort: {field: string; kind: 'asc' | 'desc'}) {
  return `${sort.kind === 'desc' ? '-' : ''}${sort.field}`;
}

export function useLogsQueryInfo({
  field,
  sort,
}: {
  field: string[];
  sort: string[];
}): LogsQueryInfo {
  const {selection} = usePageFilters();
  const logsSearch = useQueryParamsSearch();
  const {start, end, period: statsPeriod} = selection.datetime;
  const {environments, projects} = selection;

  return {
    dataset: 'logs',
    field,
    query: logsSearch.formatString(),
    project: projects,
    sort,
    start: start ? new Date(start).toISOString() : undefined,
    end: end ? new Date(end).toISOString() : undefined,
    statsPeriod: statsPeriod || undefined,
    environment: environments,
  };
}

export function LogsExportModalButton({
  error,
  estimatedRowCount,
  isLoading,
  queryInfo,
  supportsAllColumns,
  tableData,
  title,
}: LogsExportModalButtonProps) {
  const organization = useOrganization();

  const filenameBase = 'logs';

  const config: ExploreExportConfig = {
    title,
    filenameBase,
    queryInfo: {...queryInfo, dataset: TraceItemDataset.LOGS},
    asyncQueryType: ExportQueryType.EXPLORE,
    supportsAllColumns,
    availableFormats: ['csv', 'jsonl'],
    estimatedRowCount,
    localRowCount: tableData.length,
    localDownload: ({format, limit}) =>
      downloadLogs({
        rows: tableData.slice(0, limit),
        fields: queryInfo.field,
        filename: filenameBase,
        format,
      }),
    trackExportSubmit: args =>
      trackExploreTableExported({
        ...args,
        organization,
        traceItemDataset: TraceItemDataset.LOGS,
        queryInfo,
      }),
  };

  return (
    <ExploreExportModalButton
      config={config}
      isDataEmpty={!tableData?.length}
      isDataError={error !== null}
      isDataLoading={isLoading}
      onOpen={() => trackAnalytics('logs.export_modal', {organization, action: 'open'})}
      onClose={reason =>
        trackAnalytics('logs.export_modal', {
          organization,
          action: 'cancel',
          close_reason: reason,
        })
      }
    />
  );
}
