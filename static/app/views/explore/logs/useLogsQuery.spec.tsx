import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ApiResult} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import type {InfiniteData} from 'sentry/utils/queryClient';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import type {
  EventsLogsResult,
  OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {
  type LogPageParam,
  useInfiniteLogsQuery,
} from 'sentry/views/explore/logs/useLogsQuery';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

jest.mock('sentry/utils/usePageFilters');
const mockUsePageFilters = jest.mocked(usePageFilters);

type CachedQueryData = InfiniteData<ApiResult<EventsLogsResult>, LogPageParam>;

const linkHeaders = {
  Link: '<http://127.0.0.1:8000/api/0/organizations/org-slug/teams/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/teams/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
};

describe('useInfiniteLogsQuery', () => {
  const organization = OrganizationFixture();
  const queryClient = makeTestQueryClient();
  const mockLocation = mockedUsedLocation.mockReturnValue(LocationFixture());

  function createWrapper() {
    return function ({children}: {children?: React.ReactNode}) {
      return (
        <QueryClientProvider client={queryClient}>
          <LogsPageParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
          >
            <OrganizationContext.Provider value={organization}>
              {children}
            </OrganizationContext.Provider>
          </LogsPageParamsProvider>
        </QueryClientProvider>
      );
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
    mockLocation.mockReturnValue(LocationFixture());
    mockUsePageFilters.mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: PageFiltersFixture(),
    });
    queryClient.clear();
  });

  it('should not fetch logs when disabled', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: createMockLogsData([{id: '1', timestamp_precise: '100', timestamp: '100'}]),
      headers: linkHeaders,
    });

    const {result} = renderHook(({disabled}) => useInfiniteLogsQuery({disabled}), {
      wrapper: createWrapper(),
      initialProps: {disabled: true},
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toHaveLength(0);
  });

  test.each([
    ['DESC', ['9', '8', '7', '6', '5', '4', '4.1', '3', '2']],
    ['ASC', ['1', '2', '3', '4', '5', '6', '6.1', '7', '8']],
  ])('should fetch pages correctly in %s sort order', async (sort, expectedData) => {
    const mocks =
      sort === 'DESC'
        ? createDescendingMocks(organization)
        : createAscendingMocks(organization);

    if (sort === 'ASC') {
      mockLocation.mockReturnValue(
        LocationFixture({query: {[LOGS_SORT_BYS_KEY]: 'timestamp'}})
      );
    }

    const {result, rerender} = renderHook(() => useInfiniteLogsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    // Initial page.
    expect(result.current.data).toHaveLength(3);

    expect(mocks.initialMock).toHaveBeenCalled();
    expect(mocks.previousPageMock).not.toHaveBeenCalled();
    expect(mocks.nextPageMock).not.toHaveBeenCalled();

    expect(result.current.hasPreviousPage).toBe(true);
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    expect(mocks.previousPageMock).not.toHaveBeenCalled();
    expect(mocks.nextPageMock).toHaveBeenCalled();

    const queryCache = queryClient.getQueryCache();
    const queryKeys = queryCache.getAll().map(query => query.queryKey);
    const infiniteQueryKey = queryKeys.find(
      key => Array.isArray(key) && key[key.length - 1] === 'infinite'
    );

    let cachedData = queryClient.getQueryData(infiniteQueryKey!) as CachedQueryData;

    expect(cachedData.pageParams).toHaveLength(2);

    await result.current.fetchPreviousPage();

    expect(mocks.previousPageMock).toHaveBeenCalled();

    cachedData = queryClient.getQueryData(infiniteQueryKey!) as CachedQueryData;

    expect(cachedData.pageParams).toHaveLength(3);

    // Update hook to show more data.
    rerender();

    expect(result.current.data).toHaveLength(9);
    expect(result.current.data.map(datum => datum[OurLogKnownFieldKey.ID])).toEqual(
      expectedData
    );
  });

  it('should remove empty pages but maintain hasNextPage', async () => {
    const eventsEndpoint = `/organizations/${organization.slug}/events/`;

    const initialResponse = createMockLogsData([
      {id: '6', timestamp_precise: '600', timestamp: '600'},
      {id: '5', timestamp_precise: '500', timestamp: '500'},
      {id: '4', timestamp_precise: '400', timestamp: '400'},
    ]);

    const initialMock = MockApiClient.addMockResponse({
      url: eventsEndpoint,
      body: initialResponse,
      match: [
        (_, options) => {
          const query = options?.query || {};
          return query.query.length === 0;
        },
      ],
      headers: linkHeaders,
    });

    const emptyNextPageResponse = createMockLogsData([]);

    const nextPageMock = MockApiClient.addMockResponse({
      url: eventsEndpoint,
      match: [
        (_, options) => {
          const query = options?.query || {};
          return (
            query.query.startsWith(
              'tags[sentry.timestamp_precise,number]:<=400 !sentry.item_id:4'
            ) && query.sort === '-timestamp'
          );
        },
      ],
      body: emptyNextPageResponse,
      headers: linkHeaders,
    });

    const {result, rerender} = renderHook(() => useInfiniteLogsQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    expect(initialMock).toHaveBeenCalled();
    expect(nextPageMock).not.toHaveBeenCalled();
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    expect(nextPageMock).toHaveBeenCalledTimes(1);

    const queryCache = queryClient.getQueryCache();
    const queryKeys = queryCache.getAll().map(query => query.queryKey);
    const infiniteQueryKey = queryKeys.find(
      key => Array.isArray(key) && key[key.length - 1] === 'infinite'
    );

    let cachedData = queryClient.getQueryData(infiniteQueryKey!) as CachedQueryData;
    expect(cachedData.pages).toHaveLength(2);
    expect(cachedData.pageParams).toHaveLength(2);

    rerender();

    cachedData = queryClient.getQueryData(infiniteQueryKey!) as CachedQueryData;
    expect(cachedData.pages).toHaveLength(1); // Only the initial page should remain
    expect(cachedData.pageParams).toHaveLength(1);

    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    expect(nextPageMock).toHaveBeenCalledTimes(2);

    rerender();

    cachedData = queryClient.getQueryData(infiniteQueryKey!) as CachedQueryData;
    expect(cachedData.pages).toHaveLength(1);
    expect(cachedData.pageParams).toHaveLength(1);

    expect(result.current.hasNextPage).toBe(true);
  });
});

function createMockLogsData(
  rows: Array<{
    id: string;
    timestamp: string;
    timestamp_precise: string;
  }>
): EventsLogsResult {
  return {
    data: rows.map(row => ({
      [OurLogKnownFieldKey.ID]: row.id,
      [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: row.timestamp_precise,
      [OurLogKnownFieldKey.TIMESTAMP]: row.timestamp,
    })) as OurLogsResponseItem[],
    meta: {
      fields: {
        [OurLogKnownFieldKey.ID]: {type: 'string'},
        [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: {type: 'string'},
        [OurLogKnownFieldKey.TIMESTAMP]: {type: 'date'},
      } as any,
      units: {},
    },
  };
}

function createDescendingMocks(organization: Organization) {
  const eventsEndpoint = `/organizations/${organization.slug}/events/`;

  const initialResponse = createMockLogsData([
    {id: '6', timestamp_precise: '600', timestamp: '600'},
    {id: '5', timestamp_precise: '500', timestamp: '500'},
    {id: '4', timestamp_precise: '400', timestamp: '400'},
  ]);

  const initialMock = MockApiClient.addMockResponse({
    url: eventsEndpoint,
    body: initialResponse,
    match: [
      (_, options) => {
        const query = options?.query || {};
        return query.query.length === 0;
      },
    ],
    headers: linkHeaders,
  });

  // Reversed because it's the previous page.
  const previousPageResponse = createMockLogsData([
    {id: '7', timestamp_precise: '700', timestamp: '700'},
    {id: '8', timestamp_precise: '800', timestamp: '800'},
    {id: '9', timestamp_precise: '900', timestamp: '900'},
  ]);

  const previousPageMock = MockApiClient.addMockResponse({
    url: eventsEndpoint,
    match: [
      (_, options) => {
        const query = options?.query || {};
        return (
          query.query.startsWith(
            'tags[sentry.timestamp_precise,number]:>=600 !sentry.item_id:6'
          ) && query.sort === 'timestamp' // ASC. Timestamp is aliased to sort both timestamp_precise and timestamp
        );
      },
    ],
    body: previousPageResponse,
    headers: linkHeaders,
  });

  const nextPageResponse = createMockLogsData([
    {id: '4.1', timestamp_precise: '400', timestamp: '400'},
    {id: '3', timestamp_precise: '300', timestamp: '300'},
    {id: '2', timestamp_precise: '200', timestamp: '200'},
  ]);

  const nextPageMock = MockApiClient.addMockResponse({
    url: eventsEndpoint,
    match: [
      (_, options) => {
        const query = options?.query || {};
        return (
          query.query.startsWith(
            'tags[sentry.timestamp_precise,number]:<=400 !sentry.item_id:4'
          ) && query.sort === '-timestamp' // DESC. Timestamp is aliased to sort both timestamp_precise and timestamp
        );
      },
    ],
    body: nextPageResponse,
    headers: linkHeaders,
  });

  return {
    initialMock,
    previousPageMock,
    nextPageMock,
  };
}

function createAscendingMocks(organization: Organization) {
  const eventsEndpoint = `/organizations/${organization.slug}/events/`;

  const initialResponse = createMockLogsData([
    {id: '4', timestamp_precise: '400', timestamp: '400'},
    {id: '5', timestamp_precise: '500', timestamp: '500'},
    {id: '6', timestamp_precise: '600', timestamp: '600'},
  ]);

  const initialMock = MockApiClient.addMockResponse({
    url: eventsEndpoint,
    body: initialResponse,
    match: [
      (_, options) => {
        const query = options?.query || {};
        return query.query.length === 0;
      },
    ],
    headers: linkHeaders,
  });

  // Reversed because it's the previous page.
  const previousPageResponse = createMockLogsData([
    {id: '3', timestamp_precise: '300', timestamp: '300'},
    {id: '2', timestamp_precise: '200', timestamp: '200'},
    {id: '1', timestamp_precise: '100', timestamp: '100'},
  ]);

  const previousPageMock = MockApiClient.addMockResponse({
    url: eventsEndpoint,
    match: [
      (_, options) => {
        const query = options?.query || {};
        return (
          query.query.startsWith(
            'tags[sentry.timestamp_precise,number]:>=400 !sentry.item_id:4'
          ) && query.sort === '-timestamp' // DESC. Timestamp is aliased to sort both timestamp_precise and timestamp
        );
      },
    ],
    body: previousPageResponse,
    headers: linkHeaders,
  });

  const nextPageResponse = createMockLogsData([
    {id: '6.1', timestamp_precise: '600', timestamp: '600'},
    {id: '7', timestamp_precise: '700', timestamp: '700'},
    {id: '8', timestamp_precise: '800', timestamp: '800'},
  ]);

  const nextPageMock = MockApiClient.addMockResponse({
    url: eventsEndpoint,
    match: [
      (_, options) => {
        const query = options?.query || {};
        return (
          query.query.startsWith(
            'tags[sentry.timestamp_precise,number]:>=600 !sentry.item_id:6'
          ) && query.sort === 'timestamp' // ASC. Timestamp is aliased to sort both timestamp_precise and timestamp
        );
      },
    ],
    body: nextPageResponse,
    headers: linkHeaders,
  });

  return {
    initialMock,
    previousPageMock,
    nextPageMock,
  };
}

// Virtual Streaming Tests
describe('Virtual Streaming Integration (Auto Refresh enabled)', () => {
  const organization = OrganizationFixture();
  const queryClient = makeTestQueryClient();

  function createWrapper({autoRefresh = true}: {autoRefresh?: boolean}) {
    return function ({children}: {children?: React.ReactNode}) {
      return (
        <QueryClientProvider client={queryClient}>
          <LogsPageParamsProvider
            analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
            _testContext={{
              autoRefresh,
              refreshInterval: autoRefresh ? 1 : 0,
            }}
          >
            <OrganizationContext.Provider value={organization}>
              {children}
            </OrganizationContext.Provider>
          </LogsPageParamsProvider>
        </QueryClientProvider>
      );
    };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();
    queryClient.clear();
    mockedUsedLocation.mockReturnValue(LocationFixture());

    mockUsePageFilters.mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: PageFiltersFixture(),
    });
  });

  it('should integrate with virtual streaming when auto refresh is enabled', async () => {
    const initialResponse = createMockLogsData([
      {id: '4', timestamp_precise: '2000000000000000000', timestamp: '2000000000000'}, // far future
      {id: '3', timestamp_precise: '3000000000', timestamp: '3000'}, // newest
      {id: '2', timestamp_precise: '2000000000', timestamp: '2000'},
      {id: '1', timestamp_precise: '1000000000', timestamp: '1000'}, // oldest
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: initialResponse,
      headers: linkHeaders,
    });

    const {result} = renderHook(() => useInfiniteLogsQuery(), {
      wrapper: createWrapper({autoRefresh: true}),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    // With auto refresh enabled, virtual streaming should be active
    // All data should be visible initially since all the mocked timestamps are well behind `now()`
    expect(result.current.data).toHaveLength(3);
  });

  it('should not apply virtual streaming when auto refresh is disabled', async () => {
    const initialResponse = createMockLogsData([
      {id: '4', timestamp_precise: '2000000000000000000', timestamp: '2000000000000'}, // far future
      {id: '3', timestamp_precise: '3000000000', timestamp: '3000'}, // newest
      {id: '2', timestamp_precise: '2000000000', timestamp: '2000'},
      {id: '1', timestamp_precise: '1000000000', timestamp: '1000'}, // oldest
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: initialResponse,
      headers: linkHeaders,
    });

    const {result} = renderHook(() => useInfiniteLogsQuery(), {
      wrapper: createWrapper({autoRefresh: false}),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    // Without auto refresh, all data should always be visible
    expect(result.current.data).toHaveLength(4);
  });

  it('should handle multiple pages with virtual streaming', async () => {
    const eventsEndpoint = `/organizations/${organization.slug}/events/`;

    // Initial page - newer timestamps (descending order)
    const initialResponse = createMockLogsData([
      {id: '6', timestamp_precise: '6000000000', timestamp: '6000'},
      {id: '5', timestamp_precise: '5000000000', timestamp: '5000'},
      {id: '4', timestamp_precise: '4000000000', timestamp: '4000'},
    ]);

    const initialMock = MockApiClient.addMockResponse({
      url: eventsEndpoint,
      body: initialResponse,
      match: [
        (_, options) => {
          const query = options?.query || {};
          return query.query.startsWith('tags[sentry.timestamp_precise,number]:<=');
        },
      ],
      headers: linkHeaders,
    });

    // Next page - older timestamps
    const previousPageResponse = createMockLogsData([
      {id: '3', timestamp_precise: '3000000000', timestamp: '3000'},
      {id: '2', timestamp_precise: '2000000000', timestamp: '2000'},
      {id: '1', timestamp_precise: '1000000000', timestamp: '1000'},
    ]);

    const previousPageMock = MockApiClient.addMockResponse({
      url: eventsEndpoint,
      match: [
        (_, options) => {
          const query = options?.query || {};
          return query.query.startsWith(
            'tags[sentry.timestamp_precise,number]:>=6000000000 !sentry.item_id:6'
          );
        },
      ],
      body: previousPageResponse,
      headers: linkHeaders,
    });

    const {result} = renderHook(() => useInfiniteLogsQuery(), {
      wrapper: createWrapper({autoRefresh: true}),
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.data).toHaveLength(3);
    expect(initialMock).toHaveBeenCalled();

    // Fetch next page
    await result.current.fetchPreviousPage();

    await waitFor(() => {
      expect(previousPageMock).toHaveBeenCalled();
    });

    // Should now have 6 total rows (virtual streaming will filter based on its internal state)
    expect(result.current.data.length).toBeGreaterThan(0);
    expect(result.current.data.length).toBeLessThanOrEqual(6);
  });

  it('should remove duplicate rows based on unique row ID', async () => {
    const eventsEndpoint = `/organizations/${organization.slug}/events/`;

    // Create pages with overlapping data (same ID)
    const initialResponse = createMockLogsData([
      {id: '2', timestamp_precise: '2000000000', timestamp: '2000'},
      {id: '1', timestamp_precise: '1000000000', timestamp: '1000'},
    ]);

    const nextPageResponse = createMockLogsData([
      {id: '3', timestamp_precise: '3000000000', timestamp: '3000'},
      {id: '2', timestamp_precise: '2000000000', timestamp: '2000'}, // Duplicate
    ]);

    MockApiClient.addMockResponse({
      url: eventsEndpoint,
      body: initialResponse,
      match: [
        (_, options) => {
          const query = options?.query || {};
          return query.query.length === 0;
        },
      ],
      headers: linkHeaders,
    });

    MockApiClient.addMockResponse({
      url: eventsEndpoint,
      body: nextPageResponse,
      match: [
        (_, options) => {
          const query = options?.query || {};
          return query.query.includes('tags[sentry.timestamp_precise,number]:<=1000');
        },
      ],
      headers: linkHeaders,
    });

    const {result} = renderHook(() => useInfiniteLogsQuery(), {
      wrapper: createWrapper({autoRefresh: false}), // Disable auto refresh to avoid virtual streaming filtering
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.data).toHaveLength(2);

    await result.current.fetchNextPage();

    await waitFor(() => {
      // Should have 3 unique rows, not 4 (duplicate ID '2' should be filtered out)
      expect(result.current.data).toHaveLength(3);
    });

    const ids = result.current.data.map(row => row[OurLogKnownFieldKey.ID]);
    expect(ids).toEqual(['2', '1', '3']);
  });
});
