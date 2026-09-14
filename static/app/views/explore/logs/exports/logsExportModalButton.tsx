import {downloadRows} from 'sentry/components/exports/downloadRows';
import {
  ExportQueryType,
  type EventsQuerySamplingMode,
} from 'sentry/components/exports/useDataExport';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreExportModalButton} from 'sentry/views/explore/components/exports/exploreExportModalButton';
import {trackExploreTableExported} from 'sentry/views/explore/components/exports/trackExploreTableExported';
import type {ExploreExportConfig} from 'sentry/views/explore/components/exports/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {
  OurLogsAggregateResponseItem,
  OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {useQueryParamsSearch} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

export interface LogsQueryInfo {
  dataset: 'logs';
  field: string[];
  project: number[];
  query: string;
  sampling: EventsQuerySamplingMode;
  sort: string[];
  end?: string;
  environment?: string[];
  start?: string;
  statsPeriod?: string;
}

type LogsExportModalButtonProps = {
  estimatedRowCount: number;
  isLoading: boolean;
  queryInfo: LogsQueryInfo;
  supportsAllColumns: boolean;
  /**
   * Whether `tableData` holds the same values the server would export. The
   * samples table asks the API to truncate long values for display, so it opts
   * out and every one of its exports goes through the server instead.
   */
  supportsLocalDownload: boolean;
  tableData: Array<OurLogsResponseItem | OurLogsAggregateResponseItem>;
  title: string;
  error?: Error | null;
};

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
    sampling: SAMPLING_MODE.HIGH_ACCURACY,
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
  supportsLocalDownload,
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
    localRowCount: supportsLocalDownload ? tableData.length : undefined,
    localDownload: supportsLocalDownload
      ? ({format, limit}) =>
          downloadRows({
            rows: tableData.slice(0, limit),
            fields: queryInfo.field,
            filename: filenameBase,
            format,
          })
      : undefined,
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
