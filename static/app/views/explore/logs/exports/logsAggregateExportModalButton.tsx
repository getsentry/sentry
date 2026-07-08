import {t} from 'sentry/locale';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
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
  pageLinks?: string | null;
};

export function LogsAggregateExportModalButton({
  error,
  isLoading,
  pageLinks,
  tableData,
}: LogsAggregateExportModalButtonProps) {
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();

  const queryInfo = useLogsQueryInfo({
    field: [...groupBys.filter(Boolean), ...visualizes.map(visualize => visualize.yAxis)],
    sort: aggregateSortBys.map(formatExportSort),
  });

  // When there's no further page, the loaded rows are the entire result set, so the
  // export can run locally in the browser. Otherwise fall back to the server-side cap.
  const hasNextPage = parseLinkHeader(pageLinks ?? null).next?.results === true;
  const estimatedRowCount = hasNextPage ? AGGREGATE_EXPORT_MAX_ROWS : tableData.length;

  return (
    <LogsExportModalButton
      error={error}
      estimatedRowCount={estimatedRowCount}
      isLoading={isLoading}
      queryInfo={queryInfo}
      supportsAllColumns={false}
      tableData={tableData}
      title={t('Log Aggregates Export')}
    />
  );
}
