import type {ReactNode} from 'react';
import {QueryClientProvider, type QueryClient} from '@tanstack/react-query';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {FieldKind} from 'sentry/utils/fields';
import {useGetTraceItemAttributeValues} from 'sentry/views/explore/hooks/useGetTraceItemAttributeValues';
import {TraceItemDataset} from 'sentry/views/explore/types';

describe('useGetTraceItemAttributeValues', () => {
  const attributeKey = 'test.attribute';
  const tag = {
    key: attributeKey,
    name: attributeKey,
    kind: FieldKind.TAG,
  };

  function makeWrapper(queryClient: QueryClient) {
    return function Wrapper({children}: {children?: ReactNode}) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    };
  }

  function makeAttributeValue(value: string, key = attributeKey) {
    return {
      key,
      value,
      first_seen: null,
      last_seen: null,
      times_seen: null,
    };
  }

  function addAttributeValuesMock({
    body,
    key = attributeKey,
    query = {},
    substringMatch,
  }: {
    body: Array<ReturnType<typeof makeAttributeValue>>;
    substringMatch: string;
    key?: string;
    query?: Record<string, unknown>;
  }) {
    return MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${key}/values/`,
      body,
      match: [
        MockApiClient.matchQuery({
          attributeType: 'string',
          itemType: TraceItemDataset.LOGS,
          project: ['1'],
          statsPeriod: '14d',
          substringMatch,
          ...query,
        }),
      ],
    });
  }

  function renderValuesHook({
    queryClient = makeTestQueryClient(),
    ...initialProps
  }: Partial<Parameters<typeof useGetTraceItemAttributeValues>[0]> & {
    queryClient?: QueryClient;
  } = {}) {
    return renderHookWithProviders(useGetTraceItemAttributeValues, {
      additionalWrapper: makeWrapper(queryClient),
      initialProps: {
        traceItemType: TraceItemDataset.LOGS,
        type: 'string',
        ...initialProps,
      },
    });
  }

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
    const searchQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: [makeAttributeValue('search-result')],
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return query.substringMatch === 'search-query';
        },
      ],
    });

    const {result} = renderValuesHook();

    expect(searchQueryMock).not.toHaveBeenCalled();

    let searchResults: string[] = [];
    await act(async () => {
      searchResults = await result.current({tag, searchQuery: 'search-query'});
    });

    expect(searchQueryMock).toHaveBeenCalled();
    expect(searchResults).toEqual(['search-result']);
  });

  it('getTraceItemAttributeValues returns empty array for number type', async () => {
    const searchQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: [makeAttributeValue('search-result')],
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return query.query === 'search-query';
        },
      ],
    });

    const {result} = renderHookWithProviders(useGetTraceItemAttributeValues, {
      initialProps: {traceItemType: TraceItemDataset.LOGS, type: 'number'},
    });

    expect(searchQueryMock).not.toHaveBeenCalled();

    let searchResults: string[] = [];
    await act(async () => {
      searchResults = await result.current({tag, searchQuery: 'search-query'});
    });

    expect(searchQueryMock).not.toHaveBeenCalled();
    expect(searchResults).toEqual([]); // This will always return an empty array because we don't suggest values for numbers
  });

  it('getTraceItemAttributeValues returns empty array for boolean type', async () => {
    const searchQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: [makeAttributeValue('true')],
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return query.attributeType === 'boolean';
        },
      ],
    });

    const {result} = renderHookWithProviders(useGetTraceItemAttributeValues, {
      initialProps: {traceItemType: TraceItemDataset.LOGS, type: 'boolean'},
    });

    expect(searchQueryMock).not.toHaveBeenCalled();

    let searchResults: string[] = [];
    await act(async () => {
      searchResults = await result.current({tag, searchQuery: 'search-query'});
    });

    expect(searchQueryMock).not.toHaveBeenCalled();
    expect(searchResults).toEqual([]); // This will always return an empty array because we don't suggest values for booleans
  });

  it('reuses a fresh cached empty response from a shorter prefix', async () => {
    const prefixRequest = addAttributeValuesMock({substringMatch: 'fo', body: []});
    const longerRequest = addAttributeValuesMock({
      substringMatch: 'foo',
      body: [makeAttributeValue('foo-value')],
    });

    const {result} = renderValuesHook();

    let prefixResults: string[] = [];
    let longerResults: string[] = [];
    await act(async () => {
      prefixResults = await result.current({tag, searchQuery: 'fo'});
      longerResults = await result.current({tag, searchQuery: 'foo'});
    });

    expect(prefixResults).toEqual([]);
    expect(longerResults).toEqual([]);
    expect(prefixRequest).toHaveBeenCalledTimes(1);
    expect(longerRequest).not.toHaveBeenCalled();
  });

  it('does not reuse non-empty cached prefix results', async () => {
    const prefixRequest = addAttributeValuesMock({
      substringMatch: 'fo',
      body: [makeAttributeValue('foo')],
    });
    const longerRequest = addAttributeValuesMock({
      substringMatch: 'foo',
      body: [makeAttributeValue('foo-value')],
    });

    const {result} = renderValuesHook();

    let prefixResults: string[] = [];
    let longerResults: string[] = [];
    await act(async () => {
      prefixResults = await result.current({tag, searchQuery: 'fo'});
      longerResults = await result.current({tag, searchQuery: 'foo'});
    });

    expect(prefixResults).toEqual(['foo']);
    expect(longerResults).toEqual(['foo-value']);
    expect(prefixRequest).toHaveBeenCalledTimes(1);
    expect(longerRequest).toHaveBeenCalledTimes(1);
  });

  it('scopes cache reuse to otherwise-identical value query options', async () => {
    addAttributeValuesMock({substringMatch: 'fo', body: []});

    const queryClient = makeTestQueryClient();
    const {result, rerender} = renderValuesHook({queryClient});

    await act(async () => {
      await result.current({tag, searchQuery: 'fo'});
    });

    const scopedCases: Array<{
      expectedQuery: Record<string, unknown>;
      name: string;
      hookProps?: Partial<Parameters<typeof useGetTraceItemAttributeValues>[0]>;
      tagKey?: string;
    }> = [
      {
        name: 'attribute key',
        tagKey: 'other.attribute',
        expectedQuery: {},
      },
      {
        name: 'item type',
        hookProps: {traceItemType: TraceItemDataset.SPANS},
        expectedQuery: {itemType: TraceItemDataset.SPANS},
      },
      {
        name: 'project',
        hookProps: {projectIds: [2]},
        expectedQuery: {project: ['2']},
      },
      {
        name: 'datetime',
        hookProps: {
          datetime: {
            end: null,
            period: '7d',
            start: null,
            utc: false,
          },
        },
        expectedQuery: {statsPeriod: '7d'},
      },
      {
        name: 'filter query',
        hookProps: {query: 'severity:error'},
        expectedQuery: {query: 'severity:error'},
      },
    ];

    for (const scopedCase of scopedCases) {
      const key = scopedCase.tagKey ?? attributeKey;
      const longerRequest = addAttributeValuesMock({
        key,
        substringMatch: 'foo',
        body: [makeAttributeValue(`${scopedCase.name}-value`, key)],
        query: scopedCase.expectedQuery,
      });

      rerender({
        traceItemType: TraceItemDataset.LOGS,
        type: 'string',
        ...scopedCase.hookProps,
      });

      let results: string[] = [];
      await act(async () => {
        results = await result.current({
          tag: {
            key,
            name: key,
            kind: FieldKind.TAG,
          },
          searchQuery: 'foo',
        });
      });

      expect(results).toEqual([`${scopedCase.name}-value`]);
      expect(longerRequest).toHaveBeenCalledTimes(1);
    }
  });

  it('scopes cache reuse to attribute type', async () => {
    const queryClient = makeTestQueryClient();
    const cachedBooleanPrefixRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/${attributeKey}/values/`,
      body: [],
      match: [
        MockApiClient.matchQuery({
          attributeType: 'boolean',
          itemType: TraceItemDataset.LOGS,
          project: ['1'],
          statsPeriod: '14d',
          substringMatch: 'fo',
        }),
      ],
    });

    await queryClient.fetchQuery(
      apiOptions.as<Array<ReturnType<typeof makeAttributeValue>>>()(
        '/organizations/$organizationIdOrSlug/trace-items/attributes/$key/values/',
        {
          path: {organizationIdOrSlug: 'org-slug', key: attributeKey},
          staleTime: 10_000,
          query: {
            attributeType: 'boolean',
            itemType: TraceItemDataset.LOGS,
            project: ['1'],
            statsPeriod: '14d',
            substringMatch: 'fo',
          },
        }
      )
    );

    const longerRequest = addAttributeValuesMock({
      substringMatch: 'foo',
      body: [makeAttributeValue('foo-value')],
    });
    const {result} = renderValuesHook({queryClient});

    let results: string[] = [];
    await act(async () => {
      results = await result.current({tag, searchQuery: 'foo'});
    });

    expect(results).toEqual(['foo-value']);
    expect(cachedBooleanPrefixRequest).toHaveBeenCalledTimes(1);
    expect(longerRequest).toHaveBeenCalledTimes(1);
  });
});
