import type {ReactNode} from 'react';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  MultiMetricsQueryParamsProvider,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

function Wrapper({children}: {children: ReactNode}) {
  return <MultiMetricsQueryParamsProvider>{children}</MultiMetricsQueryParamsProvider>;
}

describe('MultiMetricsQueryParamsProvider', () => {
  it('sets defaults', () => {
    const {result} = renderHookWithProviders(() => useMultiMetricsQueryParams(), {
      additionalWrapper: Wrapper,
    });

    expect(result.current).toEqual([
      {
        metric: {name: '', type: ''},
        queryParams: new ReadableQueryParams({
          extrapolate: true,
          mode: Mode.AGGREGATE,
          query: '',

          cursor: '',
          fields: ['id', 'timestamp'],
          sortBys: [{field: 'timestamp', kind: 'desc'}],

          aggregateCursor: '',
          aggregateFields: [new VisualizeFunction('per_second(value)')],
          aggregateSortBys: [{field: 'per_second(value)', kind: 'desc'}],
        }),
        removeMetric: expect.any(Function),
        setQueryParams: expect.any(Function),
        setTraceMetric: expect.any(Function),
      },
    ]);
  });

  it('updates to compatible aggregate when changing metrics', () => {
    const {result} = renderHookWithProviders(() => useMultiMetricsQueryParams(), {
      additionalWrapper: Wrapper,
    });

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'counter'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'foo', type: 'counter'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('per_second(value,foo,counter,-)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'bar', type: 'gauge'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'bar', type: 'gauge'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('per_second(value,bar,gauge,-)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'qux', type: 'distribution'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'qux', type: 'distribution'},
        queryParams: expect.objectContaining({
          aggregateFields: [
            new VisualizeFunction('per_second(value,qux,distribution,-)'),
          ],
        }),
      }),
    ]);
  });

  it('updates incompatible aggregate when changing metrics', () => {
    const {result} = renderHookWithProviders(() => useMultiMetricsQueryParams(), {
      additionalWrapper: Wrapper,
    });

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'counter'}));
    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [new VisualizeFunction('sum(value,foo,counter,-)')],
        })
      )
    );
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'foo', type: 'counter'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('sum(value,foo,counter,-)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'qux', type: 'gauge'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'qux', type: 'gauge'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('avg(value,qux,gauge,-)')],
        }),
      }),
    ]);

    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [new VisualizeFunction('last(value,qux,gauge,-)')],
        })
      )
    );
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'qux', type: 'gauge'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('last(value,qux,gauge,-)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'bar', type: 'distribution'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'bar', type: 'distribution'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('p75(value,bar,distribution,-)')],
        }),
      }),
    ]);

    act(() =>
      result.current[0]!.setQueryParams(
        result.current[0]!.queryParams.replace({
          aggregateFields: [new VisualizeFunction('p99(value,bar,distribution,-)')],
        })
      )
    );
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'bar', type: 'distribution'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('p99(value,bar,distribution,-)')],
        }),
      }),
    ]);

    act(() => result.current[0]!.setTraceMetric({name: 'foo', type: 'counter'}));
    expect(result.current).toEqual([
      expect.objectContaining({
        metric: {name: 'foo', type: 'counter'},
        queryParams: expect.objectContaining({
          aggregateFields: [new VisualizeFunction('per_second(value,foo,counter,-)')],
        }),
      }),
    ]);
  });
});
