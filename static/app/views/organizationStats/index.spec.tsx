import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DATA_CATEGORY_INFO, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {PageFilters} from 'sentry/types/core';
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
  const projects = ['1', '2', '3'].map(id => ProjectFixture({id, slug: `proj-${id}`}));
  const {organization, router} = initializeOrg({
    organization: {features: ['global-views', 'team-insights']},
    projects,
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

  let mockRequest: jest.Mock;

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
    ConfigStore.init();
    ConfigStore.set('user', UserFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  /**
   * Features and Alerts
   */
  it('renders header state without tabs', async () => {
    const newOrg = initializeOrg();
    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      router: newOrg.router,
    });
    expect(await screen.findByText('Organization Usage Stats')).toBeInTheDocument();
  });

  it('renders header state with tabs', async () => {
    render(<OrganizationStats {...defaultProps} />, {router});
    expect(await screen.findByText('Stats')).toBeInTheDocument();
    expect(screen.getByText('Usage')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
  });

  /**
   * Base + Error Handling
   */
  it('renders the base view', async () => {
    render(<OrganizationStats {...defaultProps} />, {router});

    expect(await screen.findByTestId('usage-stats-chart')).toBeInTheDocument();

    // Default to Errors category
    expect(screen.getAllByText('Errors')[0]).toBeInTheDocument();

    // Render the chart and project table
    expect(screen.getByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();

    // Render the cards
    expect(screen.getAllByText('Total')[0]).toBeInTheDocument();
    // Total from cards and project table should match
    expect(screen.getAllByText('67')).toHaveLength(2);

    expect(screen.getAllByText('Accepted')[0]).toBeInTheDocument();
    // Total from cards and project table should match
    expect(screen.getAllByText('28')).toHaveLength(2);
    expect(await screen.findByText('6 in last min')).toBeInTheDocument();

    expect(screen.getAllByText('Filtered')[0]).toBeInTheDocument();
    expect(screen.getAllByText('7')[0]).toBeInTheDocument();

    expect(screen.getAllByText('Rate Limited')[0]).toBeInTheDocument();
    expect(screen.getAllByText('17')[0]).toBeInTheDocument();

    expect(screen.getAllByText('Invalid')[0]).toBeInTheDocument();
    expect(screen.getAllByText('15')[0]).toBeInTheDocument();

    // Correct API Calls
    const mockExpectations = {
      UsageStatsOrg: {
        statsPeriod: DEFAULT_STATS_PERIOD,
        interval: '1h',
        groupBy: ['outcome', 'reason'],
        project: [-1],
        field: ['sum(quantity)'],
        category: ['error'],
      },
      UsageStatsPerMin: {
        statsPeriod: '5m',
        interval: '1m',
        groupBy: ['category', 'outcome'],
        project: [-1],
        field: ['sum(quantity)'],
      },
      UsageStatsProjects: {
        statsPeriod: DEFAULT_STATS_PERIOD,
        interval: '1h',
        groupBy: ['outcome', 'project'],
        project: [-1],
        field: ['sum(quantity)'],
        category: ['error'],
      },
    };
    for (const query of Object.values(mockExpectations)) {
      expect(mockRequest).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({query})
      );
    }
  });

  it('renders with an error on stats endpoint', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: endpoint,
      statusCode: 500,
    });
    render(<OrganizationStats {...defaultProps} />, {router});

    expect(await screen.findByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();
    expect(screen.getByTestId('error-messages')).toBeInTheDocument();
  });

  it('renders with an error when user has no projects', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: endpoint,
      statusCode: 400,
      body: {detail: 'No projects available'},
    });
    render(<OrganizationStats {...defaultProps} />, {router});

    expect(await screen.findByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();
    expect(screen.getByTestId('empty-message')).toBeInTheDocument();
  });

  it('renders with just errors category for errors-only self-hosted', async () => {
    ConfigStore.set('isSelfHostedErrorsOnly', true);
    render(<OrganizationStats {...defaultProps} />, {router});
    await userEvent.click(await screen.findByText('Category'));
    // Shows only errors as stats category
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', {name: 'Errors'})).toBeInTheDocument();
  });

  /**
   * Router Handling
   */
  it('pushes state changes to the route', async () => {
    render(<OrganizationStats {...defaultProps} />, {router});

    await userEvent.click(await screen.findByText('Category'));
    await userEvent.click(screen.getByText('Attachments'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {dataCategory: DATA_CATEGORY_INFO.attachment.plural},
        })
      )
    );

    await userEvent.click(screen.getByText('Periodic'));
    await userEvent.click(screen.getByText('Cumulative'));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {transform: ChartDataTransform.CUMULATIVE},
        })
      )
    );
    const inputQuery = 'proj-1';
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Filter projects'}),
      `${inputQuery}{Enter}`
    );
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {query: inputQuery},
        })
      )
    );
  });

  it('does not leak query params onto next page links', async () => {
    const dummyLocation = PAGE_QUERY_PARAMS.reduce<{query: Record<string, string>}>(
      (location, param) => {
        location.query[param] = '';
        return location;
      },
      {query: {}}
    );
    render(<OrganizationStats {...defaultProps} location={dummyLocation as any} />, {
      router,
    });

    const projectLinks = await screen.findAllByTestId('badge-display-name');
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
  it('renders single project without global-views', async () => {
    const newOrg = initializeOrg();
    newOrg.organization.features = ['team-insights'];

    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      router: newOrg.router,
      organization: newOrg.organization,
    });

    expect(await screen.findByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
    expect(screen.queryByText('usage-stats-table')).not.toBeInTheDocument();
  });

  it('renders default projects with global-views', async () => {
    const newOrg = initializeOrg();
    newOrg.organization.features = ['global-views', 'team-insights'];
    OrganizationStore.onUpdate(newOrg.organization, {replace: true});
    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      router: newOrg.router,
      organization: newOrg.organization,
    });

    expect(await screen.findByText('All Projects')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();

    mockRequest.mock.calls.forEach(([_path, {query}]) => {
      // Ignore UsageStatsPerMin's query
      if (query?.statsPeriod === '5m') {
        return;
      }
      expect(query.project).toEqual([ALL_ACCESS_PROJECTS]);
      expect(defaultSelection.projects).toEqual([]);
    });
  });

  it('renders with multiple projects selected', async () => {
    const newOrg = initializeOrg();
    newOrg.organization.features = ['global-views', 'team-insights'];

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
      {
        router: newOrg.router,
        organization: newOrg.organization,
      }
    );
    act(() => PageFiltersStore.updateProjects(selectedProjects, []));

    expect(await screen.findByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();

    expect(mockRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        query: {
          statsPeriod: DEFAULT_STATS_PERIOD,
          interval: '1h',
          groupBy: ['outcome', 'reason'],
          project: selectedProjects,
          field: ['sum(quantity)'],
          category: ['error'],
        },
      })
    );
  });

  it('renders with a single project selected', async () => {
    const newOrg = initializeOrg();
    newOrg.organization.features = ['global-views', 'team-insights'];
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
      {
        router: newOrg.router,
        organization: newOrg.organization,
      }
    );
    act(() => PageFiltersStore.updateProjects(selectedProject, []));

    expect(await screen.findByTestId('usage-stats-chart')).toBeInTheDocument();
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
    expect(screen.getByTestId('usage-stats-table')).toBeInTheDocument();
    expect(screen.getByText('All Projects')).toBeInTheDocument();

    expect(mockRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        query: {
          statsPeriod: DEFAULT_STATS_PERIOD,
          interval: '1h',
          groupBy: ['outcome', 'reason'],
          project: selectedProject,
          field: ['sum(quantity)'],
          category: ['error'],
        },
      })
    );
  });

  it('renders a project when its graph icon is clicked', async () => {
    const newOrg = initializeOrg();
    newOrg.organization.features = ['global-views', 'team-insights'];
    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      router: newOrg.router,
      organization: newOrg.organization,
    });
    await userEvent.click(screen.getByTestId('proj-1'));
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
    expect(screen.getAllByText('proj-1').length).toBe(2);
  });

  /**
   * Feature Flagging
   */
  it('renders legacy organization stats without appropriate flags', async () => {
    const selectedProject = [1];
    const newSelection = {
      ...defaultSelection,
      projects: selectedProject,
    };
    for (const features of [['team-insights'], ['team-insights']]) {
      const newOrg = initializeOrg();
      newOrg.organization.features = features;
      render(
        <OrganizationStats
          {...defaultProps}
          organization={newOrg.organization}
          selection={newSelection}
        />,
        {
          router: newOrg.router,
          organization: newOrg.organization,
        }
      );
      act(() => PageFiltersStore.updateProjects(selectedProject, []));

      await act(tick);
      expect(screen.queryByText('My Projects')).not.toBeInTheDocument();
    }
  });

  /**
   * Feature Flagging - Continuous Profiling
   */
  it('shows only profile duration category with continuous-profiling-stats feature', async () => {
    const newOrg = initializeOrg({
      organization: {
        features: ['global-views', 'team-insights', 'continuous-profiling-stats'],
      },
    });

    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      router: newOrg.router,
    });

    await userEvent.click(await screen.findByText('Category'));

    // Should show Profile Hours option
    expect(screen.getByRole('option', {name: 'Profile Hours'})).toBeInTheDocument();
    // Should not show Profiles (transaction) option
    expect(screen.queryByRole('option', {name: 'Profiles'})).not.toBeInTheDocument();
  });

  it('shows both profile hours and profiles categories with continuous-profiling feature', async () => {
    const newOrg = initializeOrg({
      organization: {
        features: ['global-views', 'team-insights', 'continuous-profiling'],
      },
    });

    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      router: newOrg.router,
    });

    await userEvent.click(await screen.findByText('Category'));

    // Should show Profile Hours option
    expect(screen.getByRole('option', {name: 'Profile Hours'})).toBeInTheDocument();
    // Should show Profiles (transaction) option
    expect(screen.getByRole('option', {name: 'Profiles'})).toBeInTheDocument();
  });

  it('shows only profile duration category when both profiling features are enabled', async () => {
    const newOrg = initializeOrg({
      organization: {
        features: [
          'global-views',
          'team-insights',
          'continuous-profiling-stats',
          'continuous-profiling',
        ],
      },
    });

    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      router: newOrg.router,
    });

    await userEvent.click(await screen.findByText('Category'));

    // Should show Profile Hours option
    expect(screen.getByRole('option', {name: 'Profile Hours'})).toBeInTheDocument();
    // Should not show Profiles (transaction) option
    expect(screen.queryByRole('option', {name: 'Profiles'})).not.toBeInTheDocument();
  });

  it('shows only Profiles category without profiling features', async () => {
    const newOrg = initializeOrg({
      organization: {
        features: ['global-views', 'team-insights'],
      },
    });

    render(<OrganizationStats {...defaultProps} organization={newOrg.organization} />, {
      router: newOrg.router,
    });

    await userEvent.click(await screen.findByText('Category'));

    // Should show Profile Hours option
    expect(screen.queryByRole('option', {name: 'Profile Hours'})).not.toBeInTheDocument();
    // Should show Profiles (transaction) option
    expect(screen.getByRole('option', {name: 'Profiles'})).toBeInTheDocument();
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
        outcome: 'abuse',
      },
      totals: {
        'sum(quantity)': 2,
      },
      series: {
        'sum(quantity)': [2, 0, 0, 0, 0, 0, 0],
      },
    },
    {
      by: {
        project: 1,
        category: 'error',
        outcome: 'cardinality_limited',
      },
      totals: {
        'sum(quantity)': 1,
      },
      series: {
        'sum(quantity)': [1, 0, 0, 0, 0, 0, 0],
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
