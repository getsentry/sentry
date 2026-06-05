import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {
  applySeerMetricsResult,
  type SeerMetricsResult,
} from 'sentry/views/explore/metrics/applySeerMetricsResult';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import {
  decodeMetricsQueryParams,
  defaultMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';

/**
 * Applies a Seer assisted-query response to a fresh panel and returns the
 * single metric query the metrics explore UI would render — i.e. the decoded
 * `metric` URL param after the full encode → decode round-trip. Override the
 * panel's starting metric via `traceMetric`.
 */
function applySeerOutput(
  result: Partial<SeerMetricsResult>,
  {traceMetric}: {traceMetric?: TraceMetric} = {}
) {
  const base = defaultMetricQuery();
  const fullResult: SeerMetricsResult = {
    query: '',
    sort: '',
    groupBys: [],
    statsPeriod: '',
    start: null,
    end: null,
    mode: 'samples',
    visualizations: [],
    ...result,
  };

  const {encodedMetrics} = applySeerMetricsResult({
    result: fullResult,
    traceMetric: traceMetric ?? {name: 'old.metric', type: 'gauge', unit: NONE_UNIT},
    queryParams: base.queryParams,
    metricQueries: [base],
    selection: PageFiltersFixture(),
  });

  const decoded = decodeMetricsQueryParams(encodedMetrics[0]!);
  const visualize = decoded?.queryParams.aggregateFields.find(isVisualize);

  return {
    metric: decoded?.metric,
    query: decoded?.queryParams.query,
    mode: decoded?.queryParams.mode,
    yAxis: visualize?.yAxis,
  };
}

describe('applySeerMetricsResult', () => {
  it('syncs the metric from a samples-mode query and strips the metric filters', () => {
    const applied = applySeerOutput({
      mode: 'samples',
      query:
        'metric.name:db.query.duration metric.type:distribution metric.unit:millisecond span.duration:>1s',
    });

    // Metric resolved from the query filters
    expect(applied.metric).toEqual({
      name: 'db.query.duration',
      type: 'distribution',
      unit: 'millisecond',
    });
    // metric.* filters stripped, the rest of the query preserved
    expect(applied.query).toBe('span.duration:>1s');
    // Default aggregate for the metric type (distribution -> sum), qualified
    // with the resolved metric
    expect(applied.yAxis).toBe('sum(value,db.query.duration,distribution,millisecond)');
    expect(applied.mode).toBe(Mode.SAMPLES);
  });
});
