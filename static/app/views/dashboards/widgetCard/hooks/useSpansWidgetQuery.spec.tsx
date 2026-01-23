import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {DisplayType} from 'sentry/views/dashboards/types';

import {useSpansSeriesQuery, useSpansTableQuery} from './useSpansWidgetQuery';

jest.mock('sentry/views/dashboards/utils/widgetQueryQueue', () => ({
  useWidgetQueryQueue: () => ({queue: null}),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({children}: {children: React.ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSpansSeriesQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('formats Date objects in query parameters', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const startDate = new Date('2026-01-14T00:00:00.000Z');
    const endDate = new Date('2026-01-21T00:00:00.000Z');

    const pageFiltersWithDates = PageFiltersFixture({
      datetime: {
        start: startDate,
        end: endDate,
        period: null,
        utc: true,
      },
    });

    PageFiltersStore.onInitializeUrlState(pageFiltersWithDates);

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [1, [{count: 100}]],
          [2, [{count: 200}]],
        ],
      },
    });

    renderHook(useSpansSeriesQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters: pageFiltersWithDates,
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            start: '2026-01-14T00:00:00',
            end: '2026-01-21T00:00:00',
          }),
        })
      );
    });
  });

  it('applies dashboard filters correctly', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: 'transaction.duration:>100',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [[1, [{count: 100}]]],
      },
    });

    renderHook(useSpansSeriesQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        dashboardFilters: {
          release: ['1.0.0'],
        },
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('release:"1.0.0"'),
          }),
        })
      );
    });
  });

  it('handles multiple widget queries', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'query1',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          orderby: '',
        },
        {
          name: 'query2',
          fields: ['avg(transaction.duration)'],
          aggregates: ['avg(transaction.duration)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest1 = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [[1, [{count: 100}]]],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          const yAxis = Array.isArray(options.query.yAxis)
            ? options.query.yAxis[0]
            : options.query.yAxis;
          return yAxis === 'count()';
        },
      ],
    });

    const mockRequest2 = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [[1, [{count: 250}]]],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          const yAxis = Array.isArray(options.query.yAxis)
            ? options.query.yAxis[0]
            : options.query.yAxis;
          return yAxis === 'avg(transaction.duration)';
        },
      ],
    });

    renderHook(useSpansSeriesQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(mockRequest1).toHaveBeenCalled();
    });
    expect(mockRequest2).toHaveBeenCalled();
  });

  it('returns loading state while fetching', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [[1, [{count: 100}]]],
      },
    });

    const {result} = renderHook(useSpansSeriesQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        enabled: true,
      },
    });

    expect(result.current.loading).toBe(true);
  });

  it('handles API errors', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        detail: 'Internal server error',
      },
      statusCode: 500,
    });

    const {result} = renderHook(useSpansSeriesQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBeDefined();
    });
    expect(result.current.loading).toBe(false);
  });
});

describe('useSpansTableQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('formats Date objects in query parameters', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const startDate = new Date('2026-01-14T00:00:00.000Z');
    const endDate = new Date('2026-01-21T00:00:00.000Z');

    const pageFiltersWithDates = PageFiltersFixture({
      datetime: {
        start: startDate,
        end: endDate,
        period: null,
        utc: true,
      },
    });

    PageFiltersStore.onInitializeUrlState(pageFiltersWithDates);

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{transaction: '/api/test', 'count()': 100}],
      },
    });

    renderHook(useSpansTableQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters: pageFiltersWithDates,
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            start: '2026-01-14T00:00:00.000',
            end: '2026-01-21T00:00:00.000',
          }),
        })
      );
    });
  });

  it('includes starred segment query key in query key', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{transaction: '/api/test', 'count()': 100}],
      },
    });

    const {result} = renderHook(useSpansTableQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('applies dashboard filters correctly', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: 'transaction.duration:>100',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{transaction: '/api/test', 'count()': 100}],
      },
    });

    renderHook(useSpansTableQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        dashboardFilters: {
          release: ['1.0.0'],
        },
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('release:"1.0.0"'),
          }),
        })
      );
    });
  });

  it('handles pagination parameters', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{transaction: '/api/test', 'count()': 100}],
      },
    });

    renderHook(useSpansTableQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        limit: 50,
        cursor: 'test-cursor',
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 50,
            cursor: 'test-cursor',
          }),
        })
      );
    });
  });

  it('returns loading state while fetching', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{transaction: '/api/test', 'count()': 100}],
      },
    });

    const {result} = renderHook(useSpansTableQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        enabled: true,
      },
    });

    expect(result.current.loading).toBe(true);
  });

  it('handles API errors', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        detail: 'Internal server error',
      },
      statusCode: 500,
    });

    const {result} = renderHook(useSpansTableQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(result.current.errorMessage).toBeDefined();
    });
    expect(result.current.loading).toBe(false);
  });

  it('automatically sorts by is_starred_transaction when field is present', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'is_starred_transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction', 'is_starred_transaction'],
          conditions: '',
          orderby: '-count()',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {transaction: '/api/starred', is_starred_transaction: true, 'count()': 100},
          {transaction: '/api/normal', is_starred_transaction: false, 'count()': 200},
        ],
      },
    });

    renderHook(useSpansTableQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            sort: ['-is_starred_transaction', '-count()'],
          }),
        })
      );
    });
  });

  it('does not add starred sort when already sorted by starred', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'is_starred_transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: '',
          orderby: '-is_starred_transaction',
        },
      ],
    });
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{transaction: '/api/test', 'count()': 100}],
      },
    });
    renderHook(useSpansTableQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        enabled: true,
      },
    });
    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            sort: ['-is_starred_transaction'],
          }),
        })
      );
    });
  });

  it('does not add starred sort when field is not present', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['transaction', 'count()'],
          aggregates: ['count()'],
          columns: ['transaction'],
          conditions: '',
          orderby: '-count()',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{transaction: '/api/test', 'count()': 100}],
      },
    });

    renderHook(useSpansTableQuery, {
      wrapper: createWrapper(),
      initialProps: {
        widget,
        organization,
        pageFilters,
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            sort: ['-count()'],
          }),
        })
      );
    });
  });
});
