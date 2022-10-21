import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {DataCategory, PageFilters} from 'sentry/types';
import {OrganizationStats, PAGE_QUERY_PARAMS} from 'sentry/views/organizationStats';

import {ChartDataTransform} from './usageChart';

describe('OrganizationStats', function () {
  const defaultSelection: PageFilters = {
    projects: [],
    environments: [],
    datetime: {
      start: null,
      end: null,
      period: '24h',
      utc: false,
    },
  };
  const projects = ['1', '2', '3'].map(id => TestStubs.Project({id, slug: `proj-${id}`}));
  const {organization, router, routerContext} = initializeOrg({
    organization: {features: ['global-views', 'team-insights']},
    projects,
    project: undefined,
    router: undefined,
  });
  const endpoint = `/organizations/${organization.slug}/stats_v2/`;
  const defaultProps: OrganizationStats['props'] = {
    router,
    organization,
    ...router,
    route: {},
    params: {orgId: organization.slug as string},
    routeParams: {},
  };

  let mockRequest;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(defaultSelection, new Set());
    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData(projects);
    mockRequest = MockApiClient.addMockResponse({
      method: 'GET',
      url: endpoint,
      body: mockStatsResponse,
    });
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  /**
   * Features and Alerts
   */

  it('renders header state wihout tabs', () => {
    const newOrg = initializeOrg();
    const newProps = {
      ...defaultProps,
      organization: newOrg.organization,
    };
    render(<OrganizationStats {...newProps} />, {context: newOrg.routerContext});
    expect(screen.getByText('Organization Usage Stats')).toBeInTheDocument();
  });

  it('renders header state with tabs', () => {
    render(<OrganizationStats {...defaultProps} />, {context: routerContext});
    expect(screen.getByText('Stats')).toBeInTheDocument();
    expect(screen.getByText('Usage')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  /**
   * Base + Error Handling
   */
  it('renders the base view', () => {
    render(<OrganizationStats {...defaultProps} />, {context: routerContext});

    // Default to Errors category
    expect(screen.getAllByText('Errors')[0]).toBeInTheDocument();

    // Render the chart and project table
    expect(screen.getByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();

    // Render the cards
    expect(screen.getAllByText('Total')[0]).toBeInTheDocument();
    expect(screen.getByText('64')).toBeInTheDocument();

    expect(screen.getAllByText('Accepted')[0]).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('6 in last min')).toBeInTheDocument();

    expect(screen.getAllByText('Filtered')[0]).toBeInTheDocument();
    expect(screen.getAllByText('7')[0]).toBeInTheDocument();

    expect(screen.getAllByText('Dropped')[0]).toBeInTheDocument();
    expect(screen.getAllByText('29')[0]).toBeInTheDocument();

    // Correct API Calls
    const mockExpectations = {
      UsageStatsOrg: {
        statsPeriod: DEFAULT_STATS_PERIOD,
        interval: '1h',
        groupBy: ['category', 'outcome'],
        field: ['sum(quantity)'],
      },
      UsageStatsPerMin: {
        statsPeriod: '5m',
        interval: '1m',
        groupBy: ['category', 'outcome'],
        field: ['sum(quantity)'],
      },
      UsageStatsProjects: {
        statsPeriod: DEFAULT_STATS_PERIOD,
        interval: '1h',
        groupBy: ['outcome', 'project'],
        project: '-1',
        field: ['sum(quantity)'],
        category: 'error',
      },
    };
    for (const query of Object.values(mockExpectations)) {
      expect(mockRequest).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({query})
      );
    }
  });

  it('renders with an error on stats endpoint', () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: endpoint,
      statusCode: 500,
    });
    render(<OrganizationStats {...defaultProps} />, {context: routerContext});

    expect(screen.getByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();
    expect(screen.getByTestId('error-messages')).toBeInTheDocument();
  });

  it('renders with an error when user has no projects', () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: endpoint,
      statusCode: 400,
      body: {detail: 'No projects available'},
    });
    render(<OrganizationStats {...defaultProps} />, {context: routerContext});

    expect(screen.getByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();
    expect(screen.getByTestId('empty-message')).toBeInTheDocument();
  });

  /**
   * Router Handling
   */
  it('pushes state changes to the route', () => {
    render(<OrganizationStats {...defaultProps} />, {context: routerContext});

    userEvent.click(screen.getByText('Category'));
    userEvent.click(screen.getByText('Attachments'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {dataCategory: DataCategory.ATTACHMENTS},
      })
    );

    userEvent.click(screen.getByText('Periodic'));
    userEvent.click(screen.getByText('Cumulative'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {transform: ChartDataTransform.CUMULATIVE},
      })
    );

    const inputQuery = 'proj-1';
    userEvent.type(
      screen.getByPlaceholderText('Filter your projects'),
      `${inputQuery}{enter}`
    );
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {query: inputQuery},
      })
    );
  });

  it('does not leak query params onto next page links', () => {
    const dummyLocation = PAGE_QUERY_PARAMS.reduce(
      (location, param) => {
        location.query[param] = '';
        return location;
      },
      {query: {}}
    );
    const newProps = {
      ...defaultProps,
      location: dummyLocation as any,
    };
    render(<OrganizationStats {...newProps} />, {context: routerContext});

    const projectLinks = screen.getAllByTestId('badge-display-name');
    expect(projectLinks.length).toBeGreaterThan(0);
    const leakingRegex = PAGE_QUERY_PARAMS.join('|');
    for (const projectLink of projectLinks) {
      expect(projectLink.closest('a')).toHaveAttribute(
        'href',
        expect.not.stringMatching(leakingRegex)
      );
    }
  });
});

const mockStatsResponse = {
  start: '2021-01-01T00:00:00Z',
  end: '2021-01-07T00:00:00Z',
  intervals: [
    '2021-01-01T00:00:00Z',
    '2021-01-02T00:00:00Z',
    '2021-01-03T00:00:00Z',
    '2021-01-04T00:00:00Z',
    '2021-01-05T00:00:00Z',
    '2021-01-06T00:00:00Z',
    '2021-01-07T00:00:00Z',
  ],
  groups: [
    {
      by: {
        project: 1,
        category: 'attachment',
        outcome: 'accepted',
      },
      totals: {
        'sum(quantity)': 28000,
      },
      series: {
        'sum(quantity)': [1000, 2000, 3000, 4000, 5000, 6000, 7000],
      },
    },
    {
      by: {
        project: 1,
        outcome: 'accepted',
        category: 'transaction',
      },
      totals: {
        'sum(quantity)': 28,
      },
      series: {
        'sum(quantity)': [1, 2, 3, 4, 5, 6, 7],
      },
    },
    {
      by: {
        project: 1,
        category: 'error',
        outcome: 'accepted',
      },
      totals: {
        'sum(quantity)': 28,
      },
      series: {
        'sum(quantity)': [1, 2, 3, 4, 5, 6, 7],
      },
    },
    {
      by: {
        project: 1,
        category: 'error',
        outcome: 'filtered',
      },
      totals: {
        'sum(quantity)': 7,
      },
      series: {
        'sum(quantity)': [1, 1, 1, 1, 1, 1, 1],
      },
    },
    {
      by: {
        project: 1,
        category: 'error',
        outcome: 'rate_limited',
      },
      totals: {
        'sum(quantity)': 14,
      },
      series: {
        'sum(quantity)': [2, 2, 2, 2, 2, 2, 2],
      },
    },
    {
      by: {
        project: 1,
        category: 'error',
        outcome: 'invalid',
      },
      totals: {
        'sum(quantity)': 15,
      },
      series: {
        'sum(quantity)': [2, 2, 2, 2, 2, 2, 3],
      },
    },
    {
      by: {
        project: 1,
        category: 'error',
        outcome: 'client_discard',
      },
      totals: {
        'sum(quantity)': 15,
      },
      series: {
        'sum(quantity)': [2, 2, 2, 2, 2, 2, 3],
      },
    },
  ],
};
