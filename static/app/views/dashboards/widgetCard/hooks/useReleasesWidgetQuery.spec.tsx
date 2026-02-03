import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {SessionsFieldFixture} from 'sentry-fixture/sessions';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {SessionField} from 'sentry/types/sessions';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {DisplayType} from 'sentry/views/dashboards/types';

import {useReleasesSeriesQuery, useReleasesTableQuery} from './useReleasesWidgetQuery';

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

describe('useReleasesSeriesQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('makes a request to the metrics/data endpoint', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: [`crash_free_rate(${SessionField.SESSION})`],
          aggregates: [`crash_free_rate(${SessionField.SESSION})`],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`crash_free_rate(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesSeriesQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/metrics/data/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: ['session.crash_free_rate'],
            includeSeries: 1,
          }),
        })
      );
    });
  });

  it('applies dashboard filters to widget query', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: [`crash_free_rate(${SessionField.SESSION})`],
          aggregates: [`crash_free_rate(${SessionField.SESSION})`],
          columns: [],
          conditions: 'release:1.0.0',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`crash_free_rate(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesSeriesQuery({
          widget,
          organization,
          pageFilters,
          dashboardFilters: {
            release: ['2.0.0'],
          },
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/metrics/data/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('release:"2.0.0"'),
          }),
        })
      );
    });
  });

  it('uses session API for session.status grouping', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: [`sum(${SessionField.SESSION})`],
          aggregates: [`sum(${SessionField.SESSION})`],
          columns: ['session.status'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: SessionsFieldFixture(`sum(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesSeriesQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/sessions/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: [`sum(${SessionField.SESSION})`],
            groupBy: ['session.status'],
          }),
        })
      );
    });
  });

  it('includes totals when columns are present', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: [`crash_free_rate(${SessionField.SESSION})`],
          aggregates: [`crash_free_rate(${SessionField.SESSION})`],
          columns: ['release'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`crash_free_rate(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesSeriesQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/metrics/data/',
        expect.objectContaining({
          query: expect.objectContaining({
            includeSeries: 1,
            includeTotals: 1,
          }),
        })
      );
    });
  });
});

describe('useReleasesTableQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('makes a request to the metrics/data endpoint', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['release', `crash_free_rate(${SessionField.SESSION})`],
          aggregates: [`crash_free_rate(${SessionField.SESSION})`],
          columns: ['release'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`crash_free_rate(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesTableQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/metrics/data/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: ['session.crash_free_rate'],
            includeSeries: 0,
            includeTotals: 1,
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
          fields: ['release', `crash_free_rate(${SessionField.SESSION})`],
          aggregates: [`crash_free_rate(${SessionField.SESSION})`],
          columns: ['release'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`crash_free_rate(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesTableQuery({
          widget,
          organization,
          pageFilters,
          limit: 50,
          cursor: 'test-cursor',
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/metrics/data/',
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 50,
            cursor: 'test-cursor',
          }),
        })
      );
    });
  });

  it('applies dashboard filters to table query', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['release', `crash_free_rate(${SessionField.SESSION})`],
          aggregates: [`crash_free_rate(${SessionField.SESSION})`],
          columns: ['release'],
          conditions: 'environment:production',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`crash_free_rate(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesTableQuery({
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
        '/organizations/org-slug/metrics/data/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringMatching(/release:"1\.0\.0"/),
          }),
        })
      );
    });
  });

  it('uses session API when grouping by session.status', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['session.status', `sum(${SessionField.SESSION})`],
          aggregates: [`sum(${SessionField.SESSION})`],
          columns: ['session.status'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: SessionsFieldFixture(`sum(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesTableQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/sessions/',
        expect.objectContaining({
          query: expect.objectContaining({
            field: [`sum(${SessionField.SESSION})`],
            groupBy: ['session.status'],
          }),
        })
      );
    });
  });

  it('respects limit from widget', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      limit: 25,
      queries: [
        {
          name: 'test',
          fields: ['release', `crash_free_rate(${SessionField.SESSION})`],
          aggregates: [`crash_free_rate(${SessionField.SESSION})`],
          columns: ['release'],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`crash_free_rate(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesTableQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/metrics/data/',
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 25,
          }),
        })
      );
    });
  });

  it('passes per_page to sessions endpoint when using session.status grouping', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      limit: 6,
      queries: [
        {
          name: 'test',
          fields: [SessionField.STATUS, `sum(${SessionField.SESSION})`],
          aggregates: [`sum(${SessionField.SESSION})`],
          columns: [SessionField.STATUS],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: SessionsFieldFixture(`sum(${SessionField.SESSION})`),
    });

    renderHook(
      () =>
        useReleasesTableQuery({
          widget,
          organization,
          pageFilters,
          enabled: true,
        }),
      {wrapper: createWrapper()}
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/sessions/',
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 6,
          }),
        })
      );
    });
  });
});
