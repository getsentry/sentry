import {defaultMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

import {prepareQueriesForEquationMode} from './utils';

function makeQuery(aggregate: string, metricName: string, metricType: string) {
  return {
    metric: {name: metricName, type: metricType},
    queryParams: new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [
        new VisualizeFunction(`${aggregate}(value,${metricName},${metricType},none)`),
      ],
      aggregateSortBys: [
        {
          field: `${aggregate}(value,${metricName},${metricType},none)`,
          kind: 'desc' as const,
        },
      ],
    }),
  };
}

describe('prepareQueriesForEquationMode', () => {
  it('replaces per_second with the default aggregate for the metric type', () => {
    const queries = [makeQuery('per_second', 'my_counter', 'counter')];
    const result = prepareQueriesForEquationMode(queries);

    expect(result).toHaveLength(1);
    expect(result[0]!.queryParams.visualizes[0]?.yAxis).toBe(
      'sum(value,my_counter,counter,none)'
    );
  });

  it('replaces per_minute with the default aggregate for the metric type', () => {
    const queries = [makeQuery('per_minute', 'my_gauge', 'gauge')];
    const result = prepareQueriesForEquationMode(queries);

    expect(result).toHaveLength(1);
    expect(result[0]!.queryParams.visualizes[0]?.yAxis).toBe(
      'avg(value,my_gauge,gauge,none)'
    );
  });

  it('does not modify non-rate aggregates', () => {
    const queries = [
      makeQuery('sum', 'my_counter', 'counter'),
      makeQuery('p50', 'my_dist', 'distribution'),
    ];
    const result = prepareQueriesForEquationMode(queries);

    expect(result).toHaveLength(2);
    expect(result[0]!.queryParams.visualizes[0]?.yAxis).toBe(
      'sum(value,my_counter,counter,none)'
    );
    expect(result[1]!.queryParams.visualizes[0]?.yAxis).toBe(
      'p50(value,my_dist,distribution,none)'
    );
  });

  it('deduplicates queries that collapse to the same yAxis after replacement', () => {
    const queries = [
      makeQuery('per_second', 'my_counter', 'counter'),
      makeQuery('per_minute', 'my_counter', 'counter'),
    ];
    const result = prepareQueriesForEquationMode(queries);

    // Both collapse to sum(value,my_counter,counter,none)
    expect(result).toHaveLength(1);
    expect(result[0]!.queryParams.visualizes[0]?.yAxis).toBe(
      'sum(value,my_counter,counter,none)'
    );
  });

  it('keeps distinct metrics even after rate aggregate replacement', () => {
    const queries = [
      makeQuery('per_second', 'metric_a', 'counter'),
      makeQuery('per_second', 'metric_b', 'counter'),
    ];
    const result = prepareQueriesForEquationMode(queries);

    expect(result).toHaveLength(2);
    expect(result[0]!.metric.name).toBe('metric_a');
    expect(result[1]!.metric.name).toBe('metric_b');
  });

  it('passes through equation queries unchanged', () => {
    const equationQuery = defaultMetricQuery({type: 'equation'});
    const result = prepareQueriesForEquationMode([equationQuery]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(equationQuery);
  });
});
