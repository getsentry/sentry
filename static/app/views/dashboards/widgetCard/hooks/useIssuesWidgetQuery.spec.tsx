import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {DisplayType} from 'sentry/views/dashboards/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import {useIssuesSeriesQuery, useIssuesTableQuery} from './useIssuesWidgetQuery';

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

describe('useIssuesSeriesQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('makes a request to the issues-timeseries endpoint', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      queries: [
        {
          name: 'test',
          fields: ['count(new_issues)'],
          aggregates: ['count(new_issues)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-timeseries/',
      body: {
        timeSeries: [
          {
            yAxis: 'count(new_issues)',
            values: [{timestamp: 1, value: 10}],
          },
        ],
      },
    });

    renderHook(useIssuesSeriesQuery, {
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
        '/organizations/org-slug/issues-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: ['count(new_issues)'],
            category: 'issue',
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
          fields: ['count(new_issues)'],
          aggregates: ['count(new_issues)'],
          columns: [],
          conditions: 'level:error',
          orderby: '',
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-timeseries/',
      body: {
        timeSeries: [
          {
            yAxis: 'count(new_issues)',
            values: [{timestamp: 1, value: 10}],
          },
        ],
      },
    });

    renderHook(useIssuesSeriesQuery, {
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
        '/organizations/org-slug/issues-timeseries/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('release:"1.0.0"'),
          }),
        })
      );
    });
  });
});

describe('useIssuesTableQuery', () => {
  const organization = OrganizationFixture();
  const pageFilters = PageFiltersFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(pageFilters);
  });

  it('makes a request to the issues endpoint', async () => {
    const widget = WidgetFixture({
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: 'test',
          fields: ['issue', 'assignee', 'title'],
          aggregates: [],
          columns: ['issue', 'assignee', 'title'],
          conditions: '',
          orderby: IssueSortOptions.DATE,
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [
        {
          id: '1',
          shortId: 'PROJECT-1',
          title: 'Test Issue',
          project: {id: '1', slug: 'test-project'},
          count: 100,
          userCount: 10,
        },
      ],
    });

    renderHook(useIssuesTableQuery, {
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
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          data: expect.objectContaining({
            sort: IssueSortOptions.DATE,
            expand: ['owners'],
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
          fields: ['issue', 'assignee', 'title'],
          aggregates: [],
          columns: ['issue', 'assignee', 'title'],
          conditions: '',
          orderby: IssueSortOptions.DATE,
        },
      ],
    });

    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [
        {
          id: '1',
          shortId: 'PROJECT-1',
          title: 'Test Issue',
          project: {id: '1', slug: 'test-project'},
          count: 100,
          userCount: 10,
        },
      ],
    });

    renderHook(useIssuesTableQuery, {
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
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          data: expect.objectContaining({
            limit: 50,
            cursor: 'test-cursor',
          }),
        })
      );
    });
  });
});
