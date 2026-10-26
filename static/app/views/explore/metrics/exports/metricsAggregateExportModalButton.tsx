import type {ExportableRow} from 'sentry/components/exports/downloadRows';
import {ROW_COUNT_VALUE_MAX} from 'sentry/components/exports/generateExportRowCountOptions';
import {t} from 'sentry/locale';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {formatExportSort} from 'sentry/views/explore/components/exports/formatExportSort';
import {
  MetricsExportModalButton,
  useMetricsQueryInfo,
} from 'sentry/views/explore/metrics/exports/metricsExportModalButton';
import {getMetricAggregatesFields} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualizes} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';

type MetricsAggregateExportModalButtonProps = {
  isError: boolean;
  isLoading: boolean;
  tableData: ExportableRow[];
  traceMetric: TraceMetric;
  pageLinks?: string;
};

export function MetricsAggregateExportModalButton({
  isError,
  isLoading,
  pageLinks,
  tableData,
  traceMetric,
}: MetricsAggregateExportModalButtonProps) {
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useMetricVisualizes();
  const query = useQueryParamsQuery();
  const aggregateSortBys = useQueryParamsAggregateSortBys();

  const queryInfo = useMetricsQueryInfo({
    field: getMetricAggregatesFields(groupBys, visualizes, traceMetric),
    query,
    sort: aggregateSortBys.map(formatExportSort),
  });

  // Only when there's neither a next nor a previous page are the loaded rows the entire
  // result set, letting the export run locally in the browser. On any page of a paginated
  // result (including the last) fall back to the server-side cap so the full export stays
  // available.
  const links = parseLinkHeader(pageLinks ?? null);
  const isSinglePage = links.next?.results !== true && links.previous?.results !== true;
  const estimatedRowCount = isSinglePage
    ? tableData.length
    : Math.max(tableData.length, ROW_COUNT_VALUE_MAX);

  return (
    <MetricsExportModalButton
      estimatedRowCount={estimatedRowCount}
      isError={isError}
      isLoading={isLoading}
      queryInfo={queryInfo}
      tableData={tableData}
      title={t('Metric Aggregates Export')}
    />
  );
}
