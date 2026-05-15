import {useMemo, type ReactNode} from 'react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  defaultAggregateFields,
  defaultAggregateSortBys,
  defaultFields,
  defaultSortBys,
} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricAttributesTreeActions} from 'sentry/views/explore/metrics/useMetricAttributesTreeActions';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

const mockSetQueryParams = jest.fn();

function Wrapper({children}: {children: ReactNode}) {
  const queryParams = useMemo(
    () =>
      new ReadableQueryParams({
        aggregateCursor: defaultCursor(),
        aggregateFields: defaultAggregateFields(),
        aggregateSortBys: defaultAggregateSortBys(defaultAggregateFields()),
        cursor: defaultCursor(),
        extrapolate: true,
        fields: defaultFields(),
        mode: Mode.SAMPLES,
        query: '',
        sortBys: defaultSortBys(defaultFields()),
      }),
    []
  );

  return (
    <QueryParamsContextProvider
      isUsingDefaultFields={false}
      queryParams={queryParams}
      setQueryParams={mockSetQueryParams}
      shouldManageFields={false}
    >
      {children}
    </QueryParamsContextProvider>
  );
}

describe('useMetricAttributesTreeActions', () => {
  beforeEach(() => {
    mockSetQueryParams.mockClear();
  });

  it('returns filter-only attribute actions', () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'release',
        attribute_value: '1.0.0',
        original_attribute_key: 'release',
      },
      subtree: {},
      value: '1.0.0',
    };

    const actions = result.current(content);

    expect(actions.map(action => action.label)).toEqual([
      'Add to filter',
      'Exclude this value',
    ]);
    expect(actions).not.toContainEqual(
      expect.objectContaining({label: 'Add this as table column'})
    );
  });
});
