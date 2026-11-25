import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

import {useStableLabels} from './useStableLabels';

function makeQuery(yAxis: string, isEquation: boolean): BaseMetricQuery {
  const visualize = isEquation
    ? new VisualizeEquation(yAxis)
    : new VisualizeFunction(yAxis);
  return {
    metric: {name: 'metric_a', type: 'counter', unit: 'none'},
    queryParams: new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [visualize],
      aggregateSortBys: [],
    }),
  };
}

const aggregate = makeQuery('count(value,metric_a,counter,none)', false);
const equation = makeQuery('equation|count(value,metric_a,counter,none) * 2', true);

describe('useStableLabels', () => {
  it('assigns letter labels to metrics and function labels to equations', () => {
    const {result} = renderHookWithProviders(() =>
      useStableLabels([aggregate, equation])
    );
    expect(result.current.getLabel(0)).toBe('A');
    expect(result.current.getLabel(1)).toBe('ƒ1');
  });

  it('reassigns labels when query types change but the count stays the same', () => {
    const {result, rerender} = renderHookWithProviders(
      ({queries}: {queries: BaseMetricQuery[]}) => useStableLabels(queries),
      {initialProps: {queries: [aggregate, equation]}}
    );
    expect(result.current.getLabel(0)).toBe('A');
    expect(result.current.getLabel(1)).toBe('ƒ1');

    rerender({queries: [equation, aggregate]});

    expect(result.current.getLabel(0)).toBe('ƒ1');
    expect(result.current.getLabel(1)).toBe('A');
  });

  it('keeps gaps in labels when query types still match', () => {
    const {result, rerender} = renderHookWithProviders(
      ({queries}: {queries: BaseMetricQuery[]}) => useStableLabels(queries),
      {initialProps: {queries: [aggregate, aggregate, equation]}}
    );
    result.current.remove(0);
    rerender({queries: [aggregate, equation]});

    expect(result.current.getLabel(0)).toBe('B');
    expect(result.current.getLabel(1)).toBe('ƒ1');
  });
});
