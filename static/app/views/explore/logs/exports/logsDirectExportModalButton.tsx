import {t} from 'sentry/locale';
import {
  formatExportSort,
  LogsExportModalButton,
  useLogsQueryInfo,
} from 'sentry/views/explore/logs/exports/logsExportModalButton';
import {useLogsExportEstimatedRowCount} from 'sentry/views/explore/logs/exports/useLogsExportEstimatedRowCount';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsFields,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';

type LogsDirectExportModalButtonProps = {
  isLoading: boolean;
  tableData: OurLogsResponseItem[];
  error?: Error | null;
};

export function LogsDirectExportModalButton({
  error,
  isLoading,
  tableData,
}: LogsDirectExportModalButtonProps) {
  const fields = useQueryParamsFields();
  const sortBys = useQueryParamsSortBys();

  const queryInfo = useLogsQueryInfo({
    field: [...fields],
    sort: sortBys.map(formatExportSort),
  });
  const estimatedRowCount = useLogsExportEstimatedRowCount(tableData.length);

  return (
    <LogsExportModalButton
      error={error}
      estimatedRowCount={estimatedRowCount}
      isLoading={isLoading}
      queryInfo={queryInfo}
      supportsAllColumns
      tableData={tableData}
      title={t('Logs Export')}
    />
  );
}
