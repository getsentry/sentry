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

function Wrapper({children}: {children: ReactNode}) {
  const queryParams = new ReadableQueryParams({
    aggregateCursor: defaultCursor(),
    aggregateFields: [],
    aggregateSortBys: [],
    cursor: defaultCursor(),
    extrapolate: true,
    fields: [OurLogKnownFieldKey.MESSAGE, OurLogKnownFieldKey.TIMESTAMP],
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
}

describe('useLogAttributesTreeActions', () => {
  beforeEach(() => {
    mockSetQueryParams.mockClear();
  });

  it('adds columns for already typed tag attributes without nesting the key', () => {
    const {result} = renderHookWithProviders(
      () => useLogAttributesTreeActions({embedded: false}),
      {
        additionalWrapper: Wrapper,
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
});
