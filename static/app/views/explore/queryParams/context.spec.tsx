import {useMemo, type ReactNode} from 'react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useResettableState} from 'sentry/utils/useResettableState';
import {
  defaultAggregateFields,
  defaultAggregateSortBys,
  defaultFields,
  defaultQuery,
  defaultSortBys,
} from 'sentry/views/explore/metrics/metricQuery';
import {
  QueryParamsContextProvider,
  useQueryParamsCrossEvents,
  useSetQueryParamsCrossEvents,
} from 'sentry/views/explore/queryParams/context';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

const mockSetQueryParams = jest.fn();

function Wrapper({children}: {children: ReactNode}) {
  const [query] = useResettableState(defaultQuery);

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
        crossEvents: [{query: 'foo', type: 'spans'}],
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
}

describe('QueryParamsContext', () => {
  describe('crossEvents', () => {
    describe('useQueryParamsCrossEvents', () => {
      it('should return the crossEvents', () => {
        const {result} = renderHookWithProviders(() => useQueryParamsCrossEvents(), {
          additionalWrapper: Wrapper,
        });

        expect(result.current).toEqual([{query: 'foo', type: 'spans'}]);
      });
    });

    describe('useSetQueryParamsCrossEvents', () => {
      it('should set the crossEvents', () => {
        renderHookWithProviders(
          () => {
            const setCrossEvents = useSetQueryParamsCrossEvents();
            setCrossEvents([{query: 'bar', type: 'logs'}]);
            return useQueryParamsCrossEvents();
          },
          {additionalWrapper: Wrapper}
        );

        expect(mockSetQueryParams).toHaveBeenCalled();
        expect(mockSetQueryParams).toHaveBeenCalledWith({
          crossEvents: [{query: 'bar', type: 'logs'}],
        });
      });
    });
  });
});
