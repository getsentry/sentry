import {useMemo, useState, type ReactNode} from 'react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useCrossEventQueries} from 'sentry/views/explore/hooks/useCrossEventQueries';
import {
  defaultAggregateFields,
  defaultAggregateSortBys,
  defaultFields,
  defaultSortBys,
} from 'sentry/views/explore/metrics/metricQuery';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {CrossEvent} from 'sentry/views/explore/queryParams/crossEvent';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import type {CrossEventDatasetAvailability} from 'sentry/views/explore/spans/crossEvents/useCrossEventDatasetAvailability';

const mockSetQueryParams = jest.fn();
const ALL_CROSS_EVENT_DATASETS_AVAILABLE: CrossEventDatasetAvailability = {
  spans: true,
  logs: true,
  metrics: true,
};

function wrapper(crossEvents?: CrossEvent[]) {
  return function Wrapped({children}: {children: ReactNode}) {
    const [query] = useState('');

    const readableQueryParams = useMemo(
      () =>
        new ReadableQueryParams({
          aggregateCursor: defaultCursor(),
          aggregateFields: defaultAggregateFields(),
          aggregateSortBys: defaultAggregateSortBys(defaultAggregateFields()),
          cursor: defaultCursor(),
          extrapolate: true,
          fields: defaultFields(),
          mode: Mode.AGGREGATE,
          query,
          sortBys: defaultSortBys(defaultFields()),
          crossEvents,
        }),
      [query]
    );

    return (
      <QueryParamsContextProvider
        isUsingDefaultFields={false}
        queryParams={readableQueryParams}
        setQueryParams={mockSetQueryParams}
        shouldManageFields={false}
      >
        {children}
      </QueryParamsContextProvider>
    );
  };
}

describe('useCrossEventQueries', () => {
  it('returns undefined if there are no cross event queries', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper(),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    expect(result.current).toBeUndefined();
  });

  it('returns undefined if cross event queries array is empty', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([]),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    expect(result.current).toBeUndefined();
  });

  it('returns object of array of queries', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {type: 'logs', query: 'test:a'},
        {type: 'spans', query: 'test:b'},
        {type: 'spans', query: 'test:c'},
      ]),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    // Since MAX_CROSS_EVENT_QUERIES is 2, the third query ('spans') will be dropped.
    expect(result.current).toStrictEqual({
      logQuery: ['test:a'],
      spanQuery: ['test:b'],
      metricQuery: [],
    });
  });

  it('appends queries with the same types', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {type: 'spans', query: 'test:a'},
        {type: 'spans', query: 'test:b'},
        {type: 'spans', query: 'test:c'},
      ]),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    // Only first 2 are kept
    expect(result.current).toStrictEqual({
      logQuery: [],
      spanQuery: ['test:a', 'test:b'],
      metricQuery: [],
    });
  });

  it('ignores queries with invalid types', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {type: 'logs', query: 'test:a'},
        {type: 'invalid' as any, query: 'test:b'},
        {type: 'spans', query: 'test:c'},
      ]),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    expect(result.current).toStrictEqual({
      logQuery: ['test:a'],
      spanQuery: ['test:c'],
      metricQuery: [],
    });
  });

  it('ignores queries for unavailable datasets', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {type: 'logs', query: 'test:a'},
        {type: 'spans', query: 'test:b'},
        {
          type: 'metrics',
          query: 'env:prod',
          metric: {name: 'my_metric', type: 'counter'},
        },
      ]),
      initialProps: {spans: true, logs: false, metrics: false},
    });

    expect(result.current).toStrictEqual({
      logQuery: [],
      spanQuery: ['test:b'],
      metricQuery: [],
    });
  });

  it('returns undefined when all cross event queries are for unavailable datasets', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {type: 'logs', query: 'test:a'},
        {
          type: 'metrics',
          query: 'env:prod',
          metric: {name: 'my_metric', type: 'counter'},
        },
      ]),
      initialProps: {spans: true, logs: false, metrics: false},
    });

    expect(result.current).toBeUndefined();
  });

  it('prepends metric identity fields to metric queries', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {
          type: 'metrics',
          query: 'env:prod',
          metric: {name: 'my_metric', type: 'distribution', unit: 'ms'},
        },
      ]),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    expect(result.current).toStrictEqual({
      logQuery: [],
      spanQuery: [],
      metricQuery: [
        '( metric.name:my_metric metric.type:distribution metric.unit:ms ) env:prod',
      ],
    });
  });

  it('matches both !has:metric.unit and metric.unit:none when unit is absent', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {
          type: 'metrics',
          query: '',
          metric: {name: 'my_metric', type: 'counter'},
        },
      ]),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    expect(result.current).toStrictEqual({
      logQuery: [],
      spanQuery: [],
      metricQuery: [
        '( metric.name:my_metric metric.type:counter ( !has:metric.unit OR metric.unit:none ) )',
      ],
    });
  });

  it('matches both !has:metric.unit and metric.unit:none when unit is explicitly none', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {
          type: 'metrics',
          query: 'env:prod',
          metric: {name: 'my_metric', type: 'counter', unit: 'none'},
        },
      ]),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    expect(result.current).toStrictEqual({
      logQuery: [],
      spanQuery: [],
      metricQuery: [
        '( metric.name:my_metric metric.type:counter ( !has:metric.unit OR metric.unit:none ) ) env:prod',
      ],
    });
  });

  it('preserves multi-filter queries alongside metric identity filters', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {
          type: 'metrics',
          query: 'env:prod status:ok',
          metric: {name: 'my_metric', type: 'distribution', unit: 'ms'},
        },
      ]),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    expect(result.current).toStrictEqual({
      logQuery: [],
      spanQuery: [],
      metricQuery: [
        '( metric.name:my_metric metric.type:distribution metric.unit:ms ) env:prod status:ok',
      ],
    });
  });

  it('drops metric entries without a selected metric name', () => {
    const {result} = renderHookWithProviders(useCrossEventQueries, {
      additionalWrapper: wrapper([
        {type: 'metrics', query: 'env:prod', metric: {name: '', type: ''}},
      ]),
      initialProps: ALL_CROSS_EVENT_DATASETS_AVAILABLE,
    });

    expect(result.current).toStrictEqual({
      logQuery: [],
      spanQuery: [],
      metricQuery: [],
    });
  });
});
