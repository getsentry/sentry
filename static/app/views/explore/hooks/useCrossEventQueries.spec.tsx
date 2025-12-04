import {useMemo, type ReactNode} from 'react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useResettableState} from 'sentry/utils/useResettableState';
import {useCrossEventQueries} from 'sentry/views/explore/hooks/useCrossEventQueries';
import {
  defaultAggregateFields,
  defaultAggregateSortBys,
  defaultFields,
  defaultQuery,
  defaultSortBys,
} from 'sentry/views/explore/metrics/metricQuery';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import type {CrossEvent} from 'sentry/views/explore/queryParams/crossEvent';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

const mockSetQueryParams = jest.fn();

function Wrapper(crossEvents?: CrossEvent[]) {
  return function ({children}: {children: ReactNode}) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [query] = useResettableState(defaultQuery);

    // eslint-disable-next-line react-hooks/rules-of-hooks
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
    const {result} = renderHookWithProviders(() => useCrossEventQueries(), {
      additionalWrapper: Wrapper(),
    });

    expect(result.current).toBeUndefined();
  });

  it('returns undefined if cross event queries array is empty', () => {
    const {result} = renderHookWithProviders(() => useCrossEventQueries(), {
      additionalWrapper: Wrapper([]),
    });

    expect(result.current).toBeUndefined();
  });

  it('returns object of array of queries', () => {
    const {result} = renderHookWithProviders(() => useCrossEventQueries(), {
      additionalWrapper: Wrapper([
        {type: 'logs', query: 'test:a'},
        {type: 'metrics', query: 'test:b'},
        {type: 'spans', query: 'test:c'},
      ]),
    });

    // Since MAX_CROSS_EVENT_QUERIES is 2, the third query ('spans') will be dropped.
    expect(result.current).toStrictEqual({
      logQuery: ['test:a'],
      metricQuery: ['test:b'],
      spanQuery: [],
    });
  });

  it('appends queries with the same types', () => {
    const {result} = renderHookWithProviders(() => useCrossEventQueries(), {
      additionalWrapper: Wrapper([
        {type: 'spans', query: 'test:a'},
        {type: 'spans', query: 'test:b'},
        {type: 'spans', query: 'test:c'},
      ]),
    });

    // Only first 2 are kept
    expect(result.current).toStrictEqual({
      logQuery: [],
      metricQuery: [],
      spanQuery: ['test:a', 'test:b'],
    });
  });

  it('ignores queries with invalid types', () => {
    const {result} = renderHookWithProviders(() => useCrossEventQueries(), {
      additionalWrapper: Wrapper([
        {type: 'logs', query: 'test:a'},
        {type: 'invalid' as any, query: 'test:b'},
        {type: 'spans', query: 'test:c'},
      ]),
    });

    expect(result.current).toStrictEqual({
      logQuery: ['test:a'],
      metricQuery: [],
      spanQuery: ['test:c'],
    });
  });
});
