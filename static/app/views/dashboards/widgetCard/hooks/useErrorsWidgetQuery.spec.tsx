import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {DisplayType} from 'sentry/views/dashboards/types';

import {useErrorsSeriesQuery, useErrorsTableQuery} from './useErrorsWidgetQuery';

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

describe('useErrorsSeriesQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('makes a request to the errors dataset', async () => {
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

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [1, [{count: 100}]],
          [2, [{count: 200}]],
        ],
      },
    });

    renderHook(
      () =>
        useErrorsSeriesQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.ERRORS,
          }),
        })
      );
    });
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

    renderHook(
      () =>
        useErrorsSeriesQuery({
          widget,
          organization,
          pageFilters: pageFiltersWithDates,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

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
          conditions: 'browser.name:chrome',
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

    renderHook(
      () =>
        useErrorsSeriesQuery({
          widget,
          organization,
          pageFilters,
          dashboardFilters: {
            release: ['1.0.0'],
          },
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

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
          fields: ['count_unique(user)'],
          aggregates: ['count_unique(user)'],
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
        data: [[1, [{count: 50}]]],
      },
      match: [
        function (_url: string, options: Record<string, any>) {
          const yAxis = Array.isArray(options.query.yAxis)
            ? options.query.yAxis[0]
            : options.query.yAxis;
          return yAxis === 'count_unique(user)';
        },
      ],
    });

    renderHook(
      () =>
        useErrorsSeriesQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest1).toHaveBeenCalled();
    });
    expect(mockRequest2).toHaveBeenCalled();
  });
});

describe('useErrorsTableQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('makes a request to the errors dataset', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
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

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{count: 100}],
      },
    });

    renderHook(
      () =>
        useErrorsTableQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            dataset: DiscoverDatasets.ERRORS,
          }),
        })
      );
    });
  });

  it('adds timestamp field when trace column is present', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['trace', 'count()'],
          aggregates: ['count()'],
          columns: ['trace'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{trace: 'abc123', count: 100}],
      },
    });

    renderHook(
      () =>
        useErrorsTableQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: expect.arrayContaining(['trace', 'count()', 'max(timestamp)']),
          }),
        })
      );
    });
  });

  it('applies dashboard filters correctly', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
          conditions: 'browser.name:chrome',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{count: 100}],
      },
    });

    renderHook(
      () =>
        useErrorsTableQuery({
          widget,
          organization,
          pageFilters,
          dashboardFilters: {
            release: ['1.0.0'],
          },
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

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

  it('handles cursor pagination', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
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

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{count: 100}],
      },
    });

    renderHook(
      () =>
        useErrorsTableQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
          cursor: '0:10:0',
          limit: 50,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            cursor: '0:10:0',
            per_page: 50,
          }),
        })
      );
    });
  });
});
