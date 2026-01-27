import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {FieldKind} from 'sentry/utils/fields';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import {TraceItemDataset} from 'sentry/views/explore/types';

describe('useGetTraceItemAttributeValues', () => {
  const attributeKey = 'test.attribute';

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: false,
      },
    });
  });

  it('getTraceItemAttributeValues works correctly for string type', async () => {
    const mockSearchResponse = [
      {
        key: attributeKey,
        value: 'search-result',
        first_seen: null,
        last_seen: null,
        times_seen: null,
      },
    ];
    const searchQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockSearchResponse,
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return query.substringMatch === 'search-query';
        },
      ],
    });

    const {result} = renderHookWithProviders(() =>
      useGetTraceItemAttributeValues({
        traceItemType: TraceItemDataset.LOGS,
        type: 'string',
      })
    );

    const tag = {
      key: attributeKey,
      name: attributeKey,
      kind: FieldKind.TAG,
    };

    expect(searchQueryMock).not.toHaveBeenCalled();

    const searchResults = await result.current(tag, 'search-query');

    expect(searchQueryMock).toHaveBeenCalled();
    expect(searchResults).toEqual(['search-result']);
  });

  it('getTraceItemAttributeValues returns empty array for number type', async () => {
    const mockSearchResponse = [
      {
        key: attributeKey,
        value: 'search-result',
        first_seen: null,
        last_seen: null,
        times_seen: null,
      },
    ];

    const searchQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockSearchResponse,
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return query.query === 'search-query';
        },
      ],
    });

    const {result} = renderHookWithProviders(() =>
      useGetTraceItemAttributeValues({
        traceItemType: TraceItemDataset.LOGS,
        type: 'number',
      })
    );

    const tag = {
      key: attributeKey,
      name: attributeKey,
      kind: FieldKind.TAG,
    };

    expect(searchQueryMock).not.toHaveBeenCalled();

    const searchResults = await result.current(tag, 'search-query');

    expect(searchQueryMock).not.toHaveBeenCalled();
    expect(searchResults).toEqual([]); // This will always return an empty array because we don't suggest values for numbers
  });

  it('getTraceItemAttributeValues returns empty array for boolean type', async () => {
    const mockSearchResponse = [
      {
        key: attributeKey,
        value: 'true',
        first_seen: null,
        last_seen: null,
        times_seen: null,
      },
    ];
    const searchQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: mockSearchResponse,
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return query.attributeType === 'boolean';
        },
      ],
    });

    const {result} = renderHookWithProviders(() =>
      useGetTraceItemAttributeValues({
        traceItemType: TraceItemDataset.LOGS,
        type: 'boolean',
      })
    );

    const tag = {
      key: attributeKey,
      name: attributeKey,
      kind: FieldKind.TAG,
    };

    expect(searchQueryMock).not.toHaveBeenCalled();

    const searchResults = await result.current(tag, 'search-query');

    expect(searchQueryMock).not.toHaveBeenCalled();
    expect(searchResults).toEqual([]); // This will always return an empty array because we don't suggest values for booleans
  });
});
