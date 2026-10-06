import type {ExportableRow} from 'sentry/components/exports/downloadRows';
import {ROW_COUNT_VALUE_MAX} from 'sentry/components/exports/generateExportRowCountOptions';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatExportSort} from 'sentry/views/explore/components/exports/formatExportSort';
import {
  MetricsExportModalButton,
  useMetricsQueryInfo,
} from 'sentry/views/explore/metrics/exports/metricsExportModalButton';
import {
  getMetricSamplesFields,
  useMetricSamplesQueryString,
} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {
  ingestionDelayedRelativePeriod,
  TRACE_METRICS_INGESTION_DELAY_SECONDS,
} from 'sentry/views/explore/metrics/ingestionDelay';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useQueryParamsSortBys} from 'sentry/views/explore/queryParams/context';
import {useRawCounts} from 'sentry/views/explore/useRawCounts';

type MetricsSamplesExportModalButtonProps = {
  fields: string[];
  isError: boolean;
  isLoading: boolean;
  tableData: ExportableRow[];
  traceMetric: TraceMetric;
};

export function MetricsSamplesExportModalButton({
  fields,
  isError,
  isLoading,
  tableData,
  traceMetric,
}: MetricsSamplesExportModalButtonProps) {
  const {selection} = usePageFilters();
  const sortBys = useQueryParamsSortBys();
  const query = useMetricSamplesQueryString(traceMetric);

  const statsPeriodRange = ingestionDelayedRelativePeriod(
    selection.datetime,
    TRACE_METRICS_INGESTION_DELAY_SECONDS
  );

  const queryInfo = useMetricsQueryInfo({
    field: getMetricSamplesFields(fields),
    query,
    sort: sortBys.map(formatExportSort),
    statsPeriodRange,
  });

  // Counted with the export's own query rather than the metric identity alone, so a
  // user search narrows the estimate the same way it narrows the export. Counting the
  // whole metric would offer row counts the result set cannot fill and would push
  // exports to the server that the browser could have served.
  const rawMetricCounts = useRawCounts({
    dataset: DiscoverDatasets.TRACEMETRICS,
    datetime: statsPeriodRange,
    enabled: Boolean(traceMetric.name),
    query,
  });

  // The total count comes from a separate query; while it's loading or after it errors
  // the count is null, so fall back to the max option rather than collapsing the estimate
  // to the loaded page and hiding the server export.
  const totalCount = rawMetricCounts.total.count;
  const estimatedRowCount = Math.max(tableData.length, totalCount ?? ROW_COUNT_VALUE_MAX);

  return (
    <MetricsExportModalButton
      estimatedRowCount={estimatedRowCount}
      isError={isError}
      isLoading={isLoading}
      queryInfo={queryInfo}
      tableData={tableData}
      title={t('Metric Samples Export')}
    />
  );
}
