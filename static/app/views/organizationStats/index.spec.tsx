import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, cleanup, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
      period: DEFAULT_STATS_PERIOD,
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
    selection: defaultSelection,
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
  it('renders header state without tabs', () => {
    const newOrg = initializeOrg();
    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      context: newOrg.routerContext,
    });
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
        project: [],
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
        project: [],
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
    render(<OrganizationStats {...defaultProps} location={dummyLocation as any} />, {
      context: routerContext,
    });

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

  /**
   * Project Selection
   */
  it('renders with no projects selected', () => {
    const newOrg = initializeOrg();
    newOrg.organization.features = [
      'global-views',
      'team-insights',
      // TODO(Leander): Remove the following check once the project-stats flag is GA
      'project-stats',
    ];
    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      context: newOrg.routerContext,
    });

    expect(screen.getByText('My Projects')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();

    mockRequest.mock.calls.forEach(([_path, {query}]) => {
      // Ignore UsageStatsPerMin's query
      if (query?.statsPeriod === '5m') {
        return;
      }
      expect(query.project).toEqual(defaultSelection.projects);
    });
  });

  it('renders with multiple projects selected', () => {
    const newOrg = initializeOrg();
    newOrg.organization.features = [
      'global-views',
      'team-insights',
      // TODO(Leander): Remove the following check once the project-stats flag is GA
      'project-stats',
    ];

    const selectedProjects = [1, 2];
    const newSelection = {
      ...defaultSelection,
      projects: selectedProjects,
    };

    render(
      <OrganizationStats
        {...defaultProps}
        organization={newOrg.organization}
        selection={newSelection}
      />,
      {context: newOrg.routerContext}
    );
    act(() => PageFiltersStore.updateProjects(selectedProjects, []));

    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();

    expect(mockRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        query: {
          statsPeriod: DEFAULT_STATS_PERIOD,
          interval: '1h',
          groupBy: ['category', 'outcome'],
          project: selectedProjects,
          field: ['sum(quantity)'],
        },
      })
    );
  });

  it('renders with a single project selected', () => {
    const newOrg = initializeOrg();
    newOrg.organization.features = [
      'global-views',
      'team-insights',
      // TODO(Leander): Remove the following check once the project-stats flag is GA
      'project-stats',
    ];
    const selectedProject = [1];
    const newSelection = {
      ...defaultSelection,
      projects: selectedProject,
    };

    render(
      <OrganizationStats
        {...defaultProps}
        organization={newOrg.organization}
        selection={newSelection}
      />,
      {context: newOrg.routerContext}
    );
    act(() => PageFiltersStore.updateProjects(selectedProject, []));

    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-chart')).toBeInTheDocument();
    // Doesn't render for single project view
    expect(screen.queryByTestId('usage-stats-table')).not.toBeInTheDocument();

    expect(mockRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        query: {
          statsPeriod: DEFAULT_STATS_PERIOD,
          interval: '1h',
          groupBy: ['category', 'outcome'],
          project: selectedProject,
          field: ['sum(quantity)'],
        },
      })
    );
  });

  /**
   * Feature Flagging
   */
  it('renders legacy organization stats without appropriate flags', () => {
    const selectedProject = [1];
    const newSelection = {
      ...defaultSelection,
      projects: selectedProject,
    };
    for (const features of [
      ['team-insights'],
      ['team-insights', 'project-stats'],
      ['team-insights', 'global-views'],
    ]) {
      const newOrg = initializeOrg();
      newOrg.organization.features = features;
      render(
        <OrganizationStats
          {...defaultProps}
          organization={newOrg.organization}
          selection={newSelection}
        />,
        {context: newOrg.routerContext}
      );
      act(() => PageFiltersStore.updateProjects(selectedProject, []));
      expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
      expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();
      cleanup();
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
