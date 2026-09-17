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

  it('returns filter-only attribute actions for string values', () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'release',
        attribute_value: '1.0.0',
        original_attribute_key: 'release',
        type: 'str',
      },
      subtree: {},
      value: '1.0.0',
    };

    const actions = result.current(content);

    expect(actions.map(action => action.label)).toEqual([
      'Add to filter',
      'Exclude this value',
    ]);
  });

  it('returns greater/less than actions for numeric values', () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'value',
        attribute_value: 42,
        original_attribute_key: 'value',
        type: 'float',
      },
      subtree: {},
      value: 42,
    };

    const actions = result.current(content);

    expect(actions.map(action => action.label)).toEqual([
      'Add to filter',
      'Exclude this value',
      'Show values greater than',
      'Show values less than',
    ]);

    actions.find(action => action.key === 'search-for-greater-than')?.onAction?.();
    expect(mockSetQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({query: 'value:>42'})
    );

    mockSetQueryParams.mockClear();
    actions.find(action => action.key === 'search-for-less-than')?.onAction?.();
    expect(mockSetQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({query: 'value:<42'})
    );
  });

  it('returns greater/less than actions for typed number tag keys', () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'code.line.number',
        attribute_value: '100',
        original_attribute_key: 'tags[code.line.number,number]',
        type: 'str',
      },
      subtree: {},
      value: '100',
    };

    expect(result.current(content).map(action => action.label)).toEqual([
      'Add to filter',
      'Exclude this value',
      'Show values greater than',
      'Show values less than',
    ]);
  });

  it('returns no actions when originalAttribute is missing', () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      subtree: {},
      value: '',
    };

    expect(result.current(content)).toEqual([]);
  });
});
