import {useMemo, type ReactNode} from 'react';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

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
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      method: 'GET',
      body: [{attributeType: 'number', key: 'tags[latency,number]', name: 'latency'}],
    });
    mockSetQueryParams.mockClear();
  });

  it('returns filter-only attribute actions', () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'release',
        attribute_type: 'str',
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
  });

  it('builds a tags[name,number] filter when a custom numeric attribute matches', async () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'latency',
        attribute_type: 'int',
        attribute_value: 5,
        original_attribute_key: 'latency',
      },
      subtree: {},
      value: 5,
    };

    await waitFor(() => {
      result
        .current(content)
        .find(action => action.key === 'search-for-value')
        ?.onAction?.();
      expect(mockSetQueryParams).toHaveBeenLastCalledWith(
        expect.objectContaining({query: 'tags[latency,number]:5'})
      );
    });
  });

  it('builds a plain filter when the attribute is a string value', () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'release',
        attribute_type: 'str',
        attribute_value: '1.0.0',
        original_attribute_key: 'release',
      },
      subtree: {},
      value: '1.0.0',
    };

    const actions = result.current(content);
    actions.find(action => action.key === 'search-for-value')?.onAction?.();

    expect(mockSetQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({query: 'release:1.0.0'})
    );
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
