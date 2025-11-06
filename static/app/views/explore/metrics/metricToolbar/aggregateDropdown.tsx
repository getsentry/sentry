import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {OPTIONS_BY_TYPE} from 'sentry/views/explore/metrics/constants';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricVisualize,
  useSetMetricVisualize,
} from 'sentry/views/explore/metrics/metricsQueryParams';

export function AggregateDropdown({traceMetric}: {traceMetric: TraceMetric}) {
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();

  return (
    <CompactSelect
      triggerProps={{
        prefix: t('Agg'),
      }}
      options={OPTIONS_BY_TYPE[traceMetric.type] ?? []}
      value={visualize.parsedFunction?.name ?? ''}
      onChange={option => {
        setVisualize(
          visualize.replace({
            yAxis: `${option.value}(value)`,
            chartType: undefined, // Reset chart type to let determineDefaultChartType decide
          })
        );
      }}
    />
  );
}
