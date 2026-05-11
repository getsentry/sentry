import type {ReactNode} from 'react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {encodeMetricQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {
  MultiMetricsQueryParamsProvider,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

import {useMetricReferences} from './useMetricReferences';

function Wrapper({children}: {children: ReactNode}) {
  return <MultiMetricsQueryParamsProvider>{children}</MultiMetricsQueryParamsProvider>;
}

describe('useMetricReferences', () => {
  it('returns _if form for metrics with a filter and plain yAxis for metrics without', () => {
    const metricWithFilter = {
      metric: {name: 'metric_a', type: 'counter', unit: 'none'},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.SAMPLES,
        query: 'status:ok',
        cursor: '',
        fields: ['id', 'timestamp'],
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateCursor: '',
        aggregateFields: [new VisualizeFunction('count(value,metric_a,counter,none)')],
        aggregateSortBys: [{field: 'count(value,metric_a,counter,none)', kind: 'desc'}],
      }),
    };

    const metricWithoutFilter = {
      metric: {name: 'metric_b', type: 'counter', unit: 'none'},
      queryParams: new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.SAMPLES,
        query: '',
        cursor: '',
        fields: ['id', 'timestamp'],
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateCursor: '',
        aggregateFields: [new VisualizeFunction('sum(value,metric_b,counter,none)')],
        aggregateSortBys: [{field: 'sum(value,metric_b,counter,none)', kind: 'desc'}],
      }),
    };

    const {result} = renderHookWithProviders(
      () => ({
        references: useMetricReferences([
          {...metricWithFilter, label: 'A'},
          {...metricWithoutFilter, label: 'B'},
        ]),
        queries: useMultiMetricsQueryParams(),
      }),
      {
        additionalWrapper: Wrapper,
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {
              metric: [metricWithFilter, metricWithoutFilter].map(
                encodeMetricQueryParams
              ),
            },
          },
        },
      }
    );

    // Metric A has a filter, so it gets the _if form
    expect(result.current.references.A).toBe(
      'count_if(`status:ok`,value,metric_a,counter,none)'
    );

    // Metric B has no filter, so the yAxis is returned as-is
    expect(result.current.references.B).toBe('sum(value,metric_b,counter,none)');
  });
});
