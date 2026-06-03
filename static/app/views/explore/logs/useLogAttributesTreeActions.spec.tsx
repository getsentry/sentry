import type {ReactNode} from 'react';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {useLogAttributesTreeActions} from 'sentry/views/explore/logs/useLogAttributesTreeActions';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

const mockSetQueryParams = jest.fn();

function makeWrapper({
  aggregateFields = [],
  fields = [OurLogKnownFieldKey.MESSAGE, OurLogKnownFieldKey.TIMESTAMP],
}: {
  aggregateFields?: Array<{groupBy: string}>;
  fields?: string[];
} = {}) {
  return function Wrapper({children}: {children: ReactNode}) {
    const queryParams = new ReadableQueryParams({
      aggregateCursor: defaultCursor(),
      aggregateFields,
      aggregateSortBys: [],
      cursor: defaultCursor(),
      extrapolate: true,
      fields,
      mode: Mode.SAMPLES,
      query: '',
      sortBys: [],
    });

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
  };
}

describe('useLogAttributesTreeActions', () => {
  beforeEach(() => {
    mockSetQueryParams.mockClear();
  });

  it('adds columns for already typed tag attributes without nesting the key', () => {
    const {result} = renderHookWithProviders(
      () => useLogAttributesTreeActions({embedded: false}),
      {
        additionalWrapper: makeWrapper(),
      }
    );

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
    actions.find(action => action.key === 'add-column')!.onAction?.();

    expect(mockSetQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: [
          OurLogKnownFieldKey.MESSAGE,
          'tags[fallback.number,number]',
          OurLogKnownFieldKey.TIMESTAMP,
        ],
      })
    );
  });

  it('adds known numeric log fields without wrapping them as typed tags', () => {
    const {result} = renderHookWithProviders(
      () => useLogAttributesTreeActions({embedded: false}),
      {
        additionalWrapper: makeWrapper(),
      }
    );

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: OurLogKnownFieldKey.PAYLOAD_SIZE,
        attribute_value: 123,
        original_attribute_key: OurLogKnownFieldKey.PAYLOAD_SIZE,
        type: 'float' as const,
      },
      subtree: {},
      value: 123,
    };

    const actions = result.current(content);
    actions.find(action => action.key === 'add-column')!.onAction?.();

    expect(mockSetQueryParams).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: [
          OurLogKnownFieldKey.MESSAGE,
          OurLogKnownFieldKey.PAYLOAD_SIZE,
          OurLogKnownFieldKey.TIMESTAMP,
        ],
      })
    );
  });

  it('treats raw and typed attribute column keys as the same attribute', () => {
    const {result} = renderHookWithProviders(
      () => useLogAttributesTreeActions({embedded: false}),
      {
        additionalWrapper: makeWrapper({
          fields: [
            OurLogKnownFieldKey.MESSAGE,
            'fallback.number',
            OurLogKnownFieldKey.TIMESTAMP,
          ],
        }),
      }
    );

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'fallback.number',
        attribute_value: 1.23,
        original_attribute_key: 'fallback.number',
        type: 'float' as const,
      },
      subtree: {},
      value: 1.23,
    };

    const actions = result.current(content);
    const addColumn = actions.find(action => action.key === 'add-column')!;

    expect(addColumn.disabled).toBe(true);

    addColumn.onAction?.();

    expect(mockSetQueryParams).not.toHaveBeenCalled();
  });

  it('treats raw and typed attribute group-by keys as the same attribute', () => {
    const {result} = renderHookWithProviders(
      () => useLogAttributesTreeActions({embedded: false}),
      {
        additionalWrapper: makeWrapper({
          aggregateFields: [{groupBy: 'fallback.number'}],
        }),
      }
    );

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'fallback.number',
        attribute_value: 1.23,
        original_attribute_key: 'fallback.number',
        type: 'float' as const,
      },
      subtree: {},
      value: 1.23,
    };

    const actions = result.current(content);
    const addGroupBy = actions.find(action => action.key === 'add-group-by')!;

    expect(addGroupBy.disabled).toBe(true);

    addGroupBy.onAction?.();

    expect(mockSetQueryParams).not.toHaveBeenCalled();
  });
});
