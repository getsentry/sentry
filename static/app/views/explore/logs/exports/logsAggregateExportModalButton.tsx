import {t} from 'sentry/locale';
import {AGGREGATE_EXPORT_MAX_ROWS} from 'sentry/views/explore/logs/constants';
import {
  formatExportSort,
  LogsExportModalButton,
  useLogsQueryInfo,
} from 'sentry/views/explore/logs/exports/logsExportModalButton';
import type {OurLogsAggregateResponseItem} from 'sentry/views/explore/logs/types';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';

type LogsAggregateExportModalButtonProps = {
  isLoading: boolean;
  tableData: OurLogsAggregateResponseItem[];
  error?: Error | null;
};

export function LogsAggregateExportModalButton({
  error,
  isLoading,
  tableData,
}: LogsAggregateExportModalButtonProps) {
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();

  const queryInfo = useLogsQueryInfo({
    field: [...groupBys.filter(Boolean), ...visualizes.map(visualize => visualize.yAxis)],
    sort: aggregateSortBys.map(formatExportSort),
  });

  return (
    <LogsExportModalButton
      error={error}
      estimatedRowCount={AGGREGATE_EXPORT_MAX_ROWS}
      isLoading={isLoading}
      queryInfo={queryInfo}
      supportsAllColumns={false}
      tableData={tableData}
      title={t('Log Aggregates Export')}
    />
  );
}
