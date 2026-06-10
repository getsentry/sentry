import {useMemo, type ReactNode} from 'react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {
  defaultAggregateFields,
  defaultAggregateSortBys,
  defaultFields,
  defaultSortBys,
} from 'sentry/views/explore/metrics/metricQuery';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
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
        type: 'str' as const,
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

  it('adds filters for already typed tag attributes without nesting the key', () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'fallback.number',
        attribute_value: 1.23,
        original_attribute_key: 'tags[fallback.number,number]',
        type: 'float' as const,
      },
      subtree: {},
      value: 1.23,
    };

    const actions = result.current(content);
    actions[0]!.onAction?.();

    expect(mockSetQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'tags[fallback.number,number]:1.23',
      })
    );
  });

  it('adds filters for known numeric trace metric fields without wrapping them as typed tags', () => {
    const {result} = renderHookWithProviders(useMetricAttributesTreeActions, {
      additionalWrapper: Wrapper,
    });

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: TraceMetricKnownFieldKey.METRIC_VALUE,
        attribute_value: 12.3,
        original_attribute_key: TraceMetricKnownFieldKey.METRIC_VALUE,
        type: 'float' as const,
      },
      subtree: {},
      value: 12.3,
    };

    const actions = result.current(content);
    actions[0]!.onAction?.();

    expect(mockSetQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'value:12.3',
      })
    );
  });
});
