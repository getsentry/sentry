import {t} from 'sentry/locale';
import {formatExportSort} from 'sentry/views/explore/components/exports/formatExportSort';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsFields,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

import {LogsExportModalButton, useLogsQueryInfo} from './logsExportModalButton';
import {useLogsExportEstimatedRowCount} from './useLogsExportEstimatedRowCount';

type LogsDirectExportModalButtonProps = {
  isLoading: boolean;
  tableData: OurLogsResponseItem[];
  timeseriesIngestDelay: bigint;
  error?: Error | null;
};

export function LogsDirectExportModalButton({
  error,
  isLoading,
  tableData,
  timeseriesIngestDelay,
}: LogsDirectExportModalButtonProps) {
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();

  const queryInfo = useLogsQueryInfo({
    field: [...fields],
    sort: sortBys.map(formatExportSort),
  });
  const estimatedRowCount = useLogsExportEstimatedRowCount(
    tableData.length,
    timeseriesIngestDelay
  );

  return (
    <LogsExportModalButton
      error={error}
      estimatedRowCount={estimatedRowCount}
      isLoading={isLoading}
      queryInfo={queryInfo}
      supportsAllColumns
      supportsLocalDownload={false}
      tableData={tableData}
      title={t('Logs Export')}
    />
  );
}
