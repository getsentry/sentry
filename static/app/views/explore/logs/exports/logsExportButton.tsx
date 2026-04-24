import {type LogsQueryInfo} from 'sentry/components/exports/dataExport';
import {ExploreExport} from 'sentry/views/explore/components/exploreExport';
import {QUERY_PAGE_LIMIT} from 'sentry/views/explore/logs/constants';
import {downloadLogsAsCsv} from 'sentry/views/explore/logs/exports/downloadLogsAsCsv';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

type LogsExportButtonProps = {
  isLoading: boolean;
  queryInfo: LogsQueryInfo;
  tableData: OurLogsResponseItem[];
  error?: Error | null;
  threshold?: number;
};

export function LogsExportButton({
  isLoading,
  tableData,
  error,
  queryInfo,
}: LogsExportButtonProps) {
  const isDataEmpty = !tableData?.length;
  const isDataError = error !== null;

  const handleDownloadAsCsv = () => {
    downloadLogsAsCsv(tableData, queryInfo.field, 'logs');
  };

  const isMoreThanOnePage = tableData.length > QUERY_PAGE_LIMIT - 1;

  return (
    <ExploreExport
      traceItemDataset={TraceItemDataset.LOGS}
      hasReachedCSVLimit={isMoreThanOnePage}
      queryInfo={queryInfo}
      isDataEmpty={isDataEmpty}
      isDataLoading={isLoading}
      isDataError={isDataError}
      downloadAsCsv={handleDownloadAsCsv}
    />
  );
}
