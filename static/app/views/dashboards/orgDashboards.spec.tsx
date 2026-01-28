import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import OrgDashboards from 'sentry/views/dashboards/orgDashboards';

describe('OrgDashboards', () => {
  const organization = OrganizationFixture({
    features: ['dashboards-basic', 'dashboards-edit'],
  });

  const dashboardPath = `/organizations/${organization.slug}/dashboard/1/`;

  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: dashboardPath,
      query: {},
    },
    route: '/organizations/:orgId/dashboard/:dashboardId/',
  };

  const renderChildFn = () => {
    return <div>Test</div>;
  };

  beforeEach(() => {
    const mockDashboard = {
      dateCreated: '2021-08-10T21:20:46.798237Z',
      id: '1',
      title: 'Test Dashboard',
      widgets: [],
      projects: [],
      filters: {},
    };
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/1/`,
      method: 'GET',
      body: mockDashboard,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [mockDashboard],
    });
    ProjectsStore.loadInitialData([]);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('redirects to add query params for page filters if any are saved', async () => {
    const mockDashboardWithFilters = {
      dateCreated: '2021-08-10T21:20:46.798237Z',
      id: '1',
      title: 'Test Dashboard',
      widgets: [],
      projects: [1, 2],
      environment: ['alpha'],
      period: '7d',
      filters: {},
    };
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/1/`,
      method: 'GET',
      body: mockDashboardWithFilters,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [mockDashboardWithFilters],
    });
    const {router} = render(<OrgDashboards>{renderChildFn}</OrgDashboards>, {
      initialRouterConfig,
      organization,
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(router.location.query).toEqual({
      project: ['1', '2'],
      environment: 'alpha',
      statsPeriod: '7d',
    });
  });

  it('ignores query params that are not page filters for redirection', async () => {
    const mockDashboardWithFilters = {
      dateCreated: '2021-08-10T21:20:46.798237Z',
      id: '1',
      title: 'Test Dashboard',
      widgets: [],
      projects: [1, 2],
      environment: ['alpha'],
      period: '7d',
      filters: {},
    };
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/1/`,
      method: 'GET',
      body: mockDashboardWithFilters,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [mockDashboardWithFilters],
    });
    const routerConfigWithSort: RouterConfig = {
      ...initialRouterConfig,
      location: {
        pathname: dashboardPath,
        query: {
          // This query param is not a page filter, so it should not interfere
          // with the redirect logic
          sort: 'recentlyViewed',
        },
      },
    };
    const {router} = render(<OrgDashboards>{renderChildFn}</OrgDashboards>, {
      initialRouterConfig: routerConfigWithSort,
      organization,
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(router.location.query).toEqual({
      project: ['1', '2'],
      environment: 'alpha',
      statsPeriod: '7d',
      sort: 'recentlyViewed',
    });
  });

  it('does not add query params for page filters if one of the filters is defined', async () => {
    const mockDashboardWithFilters = {
      dateCreated: '2021-08-10T21:20:46.798237Z',
      id: '1',
      title: 'Test Dashboard',
      widgets: [],
      projects: [1, 2],
      environment: ['alpha'],
      period: '7d',
      filters: {},
    };
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/1/`,
      method: 'GET',
      body: mockDashboardWithFilters,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [mockDashboardWithFilters],
    });

    const routerConfigWithProject: RouterConfig = {
      ...initialRouterConfig,
      location: {
        pathname: dashboardPath,
        query: {
          // project is supplied in the URL, so we should avoid redirecting
          project: ['1'],
        },
      },
    };

    const {router} = render(<OrgDashboards>{renderChildFn}</OrgDashboards>, {
      initialRouterConfig: routerConfigWithProject,
      organization,
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(router.location.query).toEqual({
      project: '1',
    });
  });

  it('does not add query params for page filters if none are saved', async () => {
    const {router} = render(<OrgDashboards>{renderChildFn}</OrgDashboards>, {
      initialRouterConfig,
      organization,
    });

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(router.location.query).toEqual({});
  });

  it('does not redirect to add query params if location is cleared manually', async () => {
    const mockDashboardWithFilters = {
      dateCreated: '2021-08-10T21:20:46.798237Z',
      id: '1',
      title: 'Test Dashboard',
      widgets: [],
      projects: [1],
      filters: {},
    };
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/dashboards/1/`,
      method: 'GET',
      body: mockDashboardWithFilters,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [mockDashboardWithFilters],
    });

    const {rerender, router} = render(<OrgDashboards>{renderChildFn}</OrgDashboards>, {
      initialRouterConfig,
      organization,
    });

    await waitFor(() => expect(router.location.query.project).toBe('1'));

    router.navigate(dashboardPath);

    await waitFor(() => expect(router.location.query).toEqual({}));

    rerender(<OrgDashboards>{renderChildFn}</OrgDashboards>);

    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

    expect(router.location.query).toEqual({});
  });
});
