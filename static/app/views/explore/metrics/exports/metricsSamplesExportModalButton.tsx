import type {ExportableRow} from 'sentry/components/exports/downloadRows';
import {ROW_COUNT_VALUE_MAX} from 'sentry/components/exports/generateExportRowCountOptions';
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
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricEventsFilter} from 'sentry/views/explore/metrics/utils';
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
  const sortBys = useQueryParamsSortBys();
  const query = useMetricSamplesQueryString(traceMetric);

  const queryInfo = useMetricsQueryInfo({
    field: getMetricSamplesFields(fields),
    query,
    sort: sortBys.map(formatExportSort),
  });

  const rawMetricCounts = useRawCounts({
    dataset: DiscoverDatasets.TRACEMETRICS,
    enabled: Boolean(traceMetric.name),
    query: createTraceMetricEventsFilter([traceMetric]),
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
