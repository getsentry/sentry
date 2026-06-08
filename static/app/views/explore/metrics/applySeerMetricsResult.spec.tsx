import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {
  applySeerMetricsResult,
  type SeerMetricsResult,
} from 'sentry/views/explore/metrics/applySeerMetricsResult';
import {NONE_UNIT} from 'sentry/views/explore/metrics/constants';
import {
  defaultMetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {isVisualize} from 'sentry/views/explore/queryParams/visualize';

/**
 * Applies a Seer assisted-query response to a fresh panel and returns the
 * single metric query the metrics explore UI would render. Override the
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

  const {metricQueries} = applySeerMetricsResult({
    result: fullResult,
    traceMetric: traceMetric ?? {name: 'old.metric', type: 'gauge', unit: NONE_UNIT},
    queryParams: base.queryParams,
    metricQueries: [base],
    selection: PageFiltersFixture(),
  });

  const updated = metricQueries[0]!;
  const visualize = updated.queryParams.aggregateFields.find(isVisualize);

  return {
    metric: updated.metric,
    query: updated.queryParams.query,
    mode: updated.queryParams.mode,
    yAxis: visualize?.yAxis,
  };
}

describe('applySeerMetricsResult', () => {
  it('passes a qualified aggregate-mode visualization through untouched', () => {
    const applied = applySeerOutput({
      mode: 'aggregates',
      visualizations: [
        {chartType: 0, yAxes: ['p75(value,db.duration,distribution,millisecond)']},
      ],
    });

    // Metric parsed out of the visualization aggregate
    expect(applied.metric).toEqual({
      name: 'db.duration',
      type: 'distribution',
      unit: 'millisecond',
    });
    expect(applied.query).toBe('');
    // Agent's aggregate is kept as-is
    expect(applied.yAxis).toBe('p75(value,db.duration,distribution,millisecond)');
    expect(applied.mode).toBe(Mode.AGGREGATE);
  });

  it('resolves the metric from a later visualization y-axis', () => {
    const applied = applySeerOutput({
      mode: 'aggregates',
      visualizations: [
        {chartType: 0, yAxes: []},
        {chartType: 0, yAxes: ['p75(value,db.duration,distribution,millisecond)']},
      ],
    });

    // First metric-qualified y-axis wins even though it's in a later viz
    expect(applied.metric).toEqual({
      name: 'db.duration',
      type: 'distribution',
      unit: 'millisecond',
    });
    expect(applied.yAxis).toBe('p75(value,db.duration,distribution,millisecond)');
    expect(applied.mode).toBe(Mode.AGGREGATE);
  });

  it('syncs the metric from a samples-mode query and strips the metric filters', () => {
    const applied = applySeerOutput({
      mode: 'samples',
      query:
        'metric.name:db.duration metric.type:distribution metric.unit:millisecond latency:>1s',
    });

    // Metric resolved from the query filters
    expect(applied.metric).toEqual({
      name: 'db.duration',
      type: 'distribution',
      unit: 'millisecond',
    });
    // metric.* filters stripped, the rest of the query preserved
    expect(applied.query).toBe('latency:>1s');
    // Default aggregate for the metric type (distribution -> sum), qualified
    // with the resolved metric
    expect(applied.yAxis).toBe('sum(value,db.duration,distribution,millisecond)');
    expect(applied.mode).toBe(Mode.SAMPLES);
  });

  it('synthesizes a default visualize when aggregate mode returns no visualization', () => {
    const applied = applySeerOutput({
      mode: 'aggregates',
      query: 'metric.name:db.duration metric.type:distribution latency:>1s',
    });

    // Metric resolved from the query filters even without a visualization
    expect(applied.metric).toEqual({
      name: 'db.duration',
      type: 'distribution',
      unit: NONE_UNIT,
    });
    expect(applied.query).toBe('latency:>1s');
    // Default aggregate synthesized for the type, qualified with the metric
    expect(applied.yAxis).toBe('sum(value,db.duration,distribution,none)');
    expect(applied.mode).toBe(Mode.AGGREGATE);
  });

  it('preserves the existing metric, query, and visualize when nothing resolves', () => {
    const startingMetric: TraceMetric = {
      name: 'old.metric',
      type: 'gauge',
      unit: NONE_UNIT,
    };
    const applied = applySeerOutput(
      {mode: 'samples', query: 'latency:>1s'},
      {traceMetric: startingMetric}
    );

    // No metric in the response -> the panel's metric is untouched
    expect(applied.metric).toEqual(startingMetric);
    // No metric resolved -> query is left as-is (filters not stripped)
    expect(applied.query).toBe('latency:>1s');
    // Existing visualize is preserved (the panel default)
    expect(applied.yAxis).toBe('sum(value)');
    expect(applied.mode).toBe(Mode.SAMPLES);
  });
});
