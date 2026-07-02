import {useMemo, type ReactNode} from 'react';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {AttributesTreeContent} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import {useLogAttributesTreeActions} from 'sentry/views/explore/logs/useLogAttributesTreeActions';
import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {defaultCursor} from 'sentry/views/explore/queryParams/cursor';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

const mockSetQueryParams = jest.fn();

function mockAttributes() {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    method: 'GET',
    body: [
      {
        attributeType: 'number',
        key: 'tags[message.parameter.StatusCode,number]',
        name: 'message.parameter.StatusCode',
      },
      {attributeType: 'number', key: 'payload_size', name: 'payload_size'},
      {
        attributeType: 'boolean',
        key: 'tags[activity_object_created,boolean]',
        name: 'activity_object_created',
      },
      {attributeType: 'string', key: 'message.parameter.0', name: 'message.parameter.0'},
    ],
  });
}

function Wrapper({children}: {children: ReactNode}) {
  const queryParams = useMemo(
    () =>
      new ReadableQueryParams({
        aggregateCursor: defaultCursor(),
        aggregateFields: [],
        aggregateSortBys: [],
        cursor: defaultCursor(),
        extrapolate: true,
        fields: ['timestamp', 'message'],
        mode: Mode.SAMPLES,
        query: '',
        sortBys: [],
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

function renderActions() {
  return renderHookWithProviders(() => useLogAttributesTreeActions({embedded: false}), {
    additionalWrapper: Wrapper,
  });
}

function addToFilter(
  actions: ReturnType<ReturnType<typeof renderActions>['result']['current']>
) {
  actions.find(action => action.key === 'search-for-value')?.onAction?.();
}

describe('useLogAttributesTreeActions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockAttributes();
    mockSetQueryParams.mockClear();
  });

  it('builds a tags[name,number] filter for a custom numeric attribute', async () => {
    const {result} = renderActions();

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'message.parameter.StatusCode',
        attribute_type: 'int',
        attribute_value: 200,
        original_attribute_key: 'sentry.message.parameter.StatusCode',
      },
      subtree: {},
      value: 200,
    };

    await waitFor(() => {
      addToFilter(result.current(content));
      expect(mockSetQueryParams).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: 'tags[message.parameter.StatusCode,number]:200',
        })
      );
    });
  });

  it('keeps the plain key for a known numeric field', async () => {
    const {result} = renderActions();

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'payload_size',
        attribute_type: 'int',
        attribute_value: 5,
        original_attribute_key: 'payload_size',
      },
      subtree: {},
      value: 5,
    };

    await waitFor(() => {
      addToFilter(result.current(content));
      expect(mockSetQueryParams).toHaveBeenLastCalledWith(
        expect.objectContaining({query: 'payload_size:5'})
      );
    });
  });

  it('builds a tags[name,boolean] filter for a boolean attribute', async () => {
    const {result} = renderActions();

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'activity_object_created',
        attribute_type: 'bool',
        attribute_value: 'true',
        original_attribute_key: 'activity_object_created',
      },
      subtree: {},
      value: 'true',
    };

    await waitFor(() => {
      addToFilter(result.current(content));
      expect(mockSetQueryParams).toHaveBeenLastCalledWith(
        expect.objectContaining({query: 'tags[activity_object_created,boolean]:true'})
      );
    });
  });

  it('keeps the plain key for a string value', () => {
    const {result} = renderActions();

    const content: AttributesTreeContent = {
      originalAttribute: {
        attribute_key: 'message.parameter.0',
        attribute_type: 'str',
        attribute_value: '18446744073709551615',
        original_attribute_key: 'sentry.message.parameter.0',
      },
      subtree: {},
      value: '18446744073709551615',
    };

    addToFilter(result.current(content));

    expect(mockSetQueryParams).toHaveBeenLastCalledWith(
      expect.objectContaining({query: 'sentry.message.parameter.0:18446744073709551615'})
    );
  });
});
