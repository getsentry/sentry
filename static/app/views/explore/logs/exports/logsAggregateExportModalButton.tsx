import {t} from 'sentry/locale';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {AGGREGATE_EXPORT_MAX_ROWS} from 'sentry/views/explore/logs/constants';
import {
  formatExportSort,
  LogsExportModalButton,
  useLogsQueryInfo,
} from 'sentry/views/explore/logs/exports/logsExportModalButton';
import type {OurLogsAggregateResponseItem} from 'sentry/views/explore/logs/types';
import {getLogsAggregatesFields} from 'sentry/views/explore/logs/useLogsAggregatesTable';
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
    field: getLogsAggregatesFields(groupBys, visualizes),
    sort: aggregateSortBys.map(formatExportSort),
  });

  // Only when there's neither a next nor a previous page are the loaded rows the entire
  // result set, letting the export run locally in the browser. On any page of a paginated
  // result (including the last) fall back to the server-side cap so the full export stays
  // available.
  const links = parseLinkHeader(pageLinks ?? null);
  const isSinglePage = links.next?.results !== true && links.previous?.results !== true;
  const estimatedRowCount = isSinglePage ? tableData.length : AGGREGATE_EXPORT_MAX_ROWS;

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
