import {useCallback} from 'react';

import {Grid} from 'sentry/components/core/layout/grid';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricVisualize,
  useSetMetricVisualize,
  useSetTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricToolbar/aggregateDropdown';
import {DeleteMetricButton} from 'sentry/views/explore/metrics/metricToolbar/deleteMetricButton';
import {Filter} from 'sentry/views/explore/metrics/metricToolbar/filter';
import {GroupBySelector} from 'sentry/views/explore/metrics/metricToolbar/groupBySelector';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {VisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';

interface MetricToolbarProps {
  queryIndex: number;
  traceMetric: TraceMetric;
}

export function MetricToolbar({traceMetric, queryIndex}: MetricToolbarProps) {
  const metricQueries = useMultiMetricsQueryParams();
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const toggleVisibility = useCallback(() => {
    setVisualize(visualize.replace({visible: !visualize.visible}));
  }, [setVisualize, visualize]);
  const setTraceMetric = useSetTraceMetric();

  return (
    <Grid
      width="100%"
      align="center"
      gap="md"
      columns={`24px auto auto auto 1fr ${metricQueries.length > 1 ? '40px' : '0'}`}
      data-test-id="metric-toolbar"
    >
      <VisualizeLabel
        index={queryIndex}
        visualize={visualize}
        onClick={toggleVisibility}
      />
      <MetricSelector traceMetric={traceMetric} onChange={setTraceMetric} />
      <AggregateDropdown traceMetric={traceMetric} />
      <GroupBySelector traceMetric={traceMetric} />
      <Filter traceMetric={traceMetric} />
      {metricQueries.length > 1 && <DeleteMetricButton />}
    </Grid>
  );
}
