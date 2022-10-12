import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {PageFilters} from 'sentry/types';
import OrganizationStats from 'sentry/views/organizationStats';

/**
 * Note: Rather than write tests for new features on the Stats components in
 * the outdated enzyme syntax, this file is meant to aid in the transition to RTL.
 * Please add tests here rather than `index.spec.jsx` as we slowly migrate away from enzyme.
 */

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
  const projects = [1, 2, 3].map(id => TestStubs.Project({id, slug: `proj-${id}`}));
  const {organization, routerContext} = initializeOrg({
    organization: {features: ['global-views', 'team-insights']},
    project: undefined,
    projects,
    router: {
      location: {
        pathname: '/organizations/org-slug/issues/',
        query: {},
      },
      params: {orgId: 'org-slug'},
    },
  });
  let mockRequest;

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(defaultSelection, new Set());
    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData(organization.projects);
    mockRequest = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/stats_v2/`,
      body: mockStatsResponse,
    });
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('renders with no projects selected', async () => {
    render(<OrganizationStats />, {
      context: routerContext,
      organization,
    });
    expect(await screen.findByText('My Projects')).toBeInTheDocument();

    const usageStatsOrganization = await screen.findByTestId('usage-stats-chart');
    expect(usageStatsOrganization).toBeInTheDocument();
    const usageStatsProjects = await screen.findByTestId('usage-stats-table');
    expect(usageStatsProjects).toBeInTheDocument();

    expect(mockRequest).toHaveBeenCalled();

    mockRequest.mock.calls.forEach(([_path, {query}]) => {
      // Ignore UsageStatsPerMin's query
      if (query?.statsPeriod === '5m') {
        return;
      }
      expect(query.project).toEqual(defaultSelection.projects);
    });
  });

  it('renders with multiple projects selected', async () => {
    render(<OrganizationStats />, {
      context: routerContext,
      organization,
    });

    const selectedProjects = new Set([1, 2]);
    act(() => PageFiltersStore.updateProjects([...selectedProjects], []));
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();

    const usageStatsOrganization = await screen.findByTestId('usage-stats-chart');
    expect(usageStatsOrganization).toBeInTheDocument();
    const usageStatsProjects = await screen.findByTestId('usage-stats-table');
    expect(usageStatsProjects).toBeInTheDocument();

    expect(mockRequest).toHaveBeenCalled();
    const isQueryingForProjects = mockRequest.mock.calls.some(([_path, {query}]) => {
      // Grouping by project is specified...
      const isGrouping = query?.groupBy?.includes('project');
      // And we're only querying the selected projects
      const hasSelectedProjects = query?.project?.every(id => selectedProjects.has(id));
      return isGrouping && hasSelectedProjects;
    });
    expect(isQueryingForProjects).toBe(true);
  });

  it('renders with a single project selected', async () => {
    render(<OrganizationStats />, {
      context: routerContext,
      organization,
    });
    const selectedProject = [1];
    act(() => PageFiltersStore.updateProjects(selectedProject, []));
    expect(screen.queryByText('My Projects')).not.toBeInTheDocument();

    const usageStatsOrganization = await screen.findByTestId('usage-stats-chart');
    expect(usageStatsOrganization).toBeInTheDocument();
    // Doesn't render for single project view
    const usageStatsProjects = await screen.queryByTestId('usage-stats-table');
    expect(usageStatsProjects).not.toBeInTheDocument();

    expect(mockRequest).toHaveBeenCalled();
    const isQueryingForProjects = mockRequest.mock.calls.some(([_path, {query}]) => {
      return query.project === selectedProject;
    });
    expect(isQueryingForProjects).toBe(true);
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
