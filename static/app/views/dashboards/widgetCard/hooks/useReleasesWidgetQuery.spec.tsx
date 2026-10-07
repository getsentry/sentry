import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {SessionsFieldFixture} from 'sentry-fixture/sessions';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {SessionField} from 'sentry/types/sessions';
import {DisplayType} from 'sentry/views/dashboards/types';

import {useReleasesSeriesQuery, useReleasesTableQuery} from './useReleasesWidgetQuery';

jest.mock('sentry/views/dashboards/utils/widgetQueryQueue', () => ({
  useWidgetQueryQueue: () => ({queue: null}),
}));

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

    renderHookWithProviders(() =>
      useReleasesSeriesQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
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

    renderHookWithProviders(() =>
      useReleasesSeriesQuery({
        widget,
        organization,
        pageFilters,
        dashboardFilters: {
          release: ['2.0.0'],
        },
        enabled: true,
      })
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

    renderHookWithProviders(() =>
      useReleasesSeriesQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
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

    renderHookWithProviders(() =>
      useReleasesSeriesQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
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

    renderHookWithProviders(() =>
      useReleasesTableQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
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

    renderHookWithProviders(() =>
      useReleasesTableQuery({
        widget,
        organization,
        pageFilters,
        limit: 50,
        cursor: 'test-cursor',
        enabled: true,
      })
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

    renderHookWithProviders(() =>
      useReleasesTableQuery({
        widget,
        organization,
        pageFilters,
        dashboardFilters: {
          release: ['1.0.0'],
        },
        enabled: true,
      })
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

    renderHookWithProviders(() =>
      useReleasesTableQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
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

    renderHookWithProviders(() =>
      useReleasesTableQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
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

    renderHookWithProviders(() =>
      useReleasesTableQuery({
        widget,
        organization,
        pageFilters,
        enabled: true,
      })
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

  it('orders groups by release without mutating the response', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: '',
          fields: ['release', 'project', 'count_unique(user)'],
          aggregates: ['count_unique(user)'],
          columns: ['release', 'project'],
          conditions: '',
          orderby: 'release',
        },
      ],
    });

    // Most recent first, as returned when sorting releases by date
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [{version: '2.0'}, {version: '1.0'}],
    });
    const response = {
      start: '2022-01-15T00:00:00Z',
      end: '2022-01-29T00:00:00Z',
      query: '',
      intervals: [],
      groups: [
        {
          by: {release: '2.0', project: 2},
          totals: {'count_unique(sentry.sessions.user)': 2},
          series: {},
        },
        {
          by: {release: '1.0', project: 2},
          totals: {'count_unique(sentry.sessions.user)': 1},
          series: {},
        },
      ],
    };
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: response,
    });
    ProjectsStore.loadInitialData([ProjectFixture({id: '2', slug: 'project-slug'})]);

    const {result} = renderHookWithProviders(() =>
      useReleasesTableQuery({widget, organization, pageFilters, enabled: true, limit: 5})
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tableResults?.[0]?.data).toEqual([
      expect.objectContaining({release: '1.0', project: 'project-slug'}),
      expect.objectContaining({release: '2.0', project: 'project-slug'}),
    ]);
    expect(result.current.rawData[0].groups.map((group: any) => group.by)).toEqual([
      {release: '2.0', project: 2},
      {release: '1.0', project: 2},
    ]);
  });
});
