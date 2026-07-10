import {type LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {ExportQueryType} from 'sentry/components/exports/useDataExport';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ExploreExportModalButton} from 'sentry/views/explore/components/exports/exploreExportModalButton';
import {trackExploreTableExported} from 'sentry/views/explore/components/exports/trackExploreTableExported';
import type {ExploreExportConfig} from 'sentry/views/explore/components/exports/types';
import {downloadLogs} from 'sentry/views/explore/logs/exports/downloadLogs';
import {useLogsExportEstimatedRowCount} from 'sentry/views/explore/logs/exports/useLogsExportEstimatedRowCount';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsFields,
  useQueryParamsSearch,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

type LogsExportModalButtonProps = {
  isLoading: boolean;
  tableData: OurLogsResponseItem[];
  error?: Error | null;
};

function useLogsQueryInfo(): LogsQueryInfo {
  const {selection} = usePageFilters();
  const logsSearch = useQueryParamsSearch();
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();
  const {start, end, period: statsPeriod} = selection.datetime;
  const {environments, projects} = selection;

  return {
    dataset: 'logs',
    field: [...fields],
    query: logsSearch.formatString(),
    project: projects,
    sort: sortBys.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
    start: start ? new Date(start).toISOString() : undefined,
    end: end ? new Date(end).toISOString() : undefined,
    statsPeriod: statsPeriod || undefined,
    environment: environments,
  };
}

export function LogsExportModalButton({
  error,
  isLoading,
  tableData,
}: LogsExportModalButtonProps) {
  const organization = useOrganization();
  const queryInfo = useLogsQueryInfo();
  const estimatedRowCount = useLogsExportEstimatedRowCount(tableData.length);

  const filenameBase = 'logs';

  const config: ExploreExportConfig = {
    title: t('Logs Export'),
    filenameBase,
    queryInfo: {...queryInfo, dataset: TraceItemDataset.LOGS},
    asyncQueryType: ExportQueryType.EXPLORE,
    supportsAllColumns: true,
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
