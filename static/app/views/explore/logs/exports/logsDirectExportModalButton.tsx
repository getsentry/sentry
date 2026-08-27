import {t} from 'sentry/locale';
import {formatExportSort} from 'sentry/views/explore/components/exports/formatExportSort';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
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
    // Without this the server export falls back to normal sampling and can hand
    // back a downsampled set of the rows on screen. Not the table's flex-time
    // mode though: this export paginates by offset and stops on the first short
    // page, and flex-time returns short pages as it walks its time windows. Only
    // the "All Columns" export can afford flex-time, because it continues on a
    // page token rather than an offset.
    sampling: SAMPLING_MODE.HIGH_ACCURACY,
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
