import {browserHistory} from 'react-router';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import DashboardDetail from 'sentry/views/dashboards/detail';
import OrgDashboards from 'sentry/views/dashboards/orgDashboards';
import {DashboardState} from 'sentry/views/dashboards/types';

describe('OrgDashboards', () => {
  const api = new MockApiClient();
  const organization = Organization({
    features: ['dashboards-basic', 'dashboards-edit'],
  });

  let initialData;
  beforeEach(() => {
    initialData = initializeOrg({
      organization,
      projects: [],
      router: {
        location: LocationFixture(),
        params: {orgId: 'org-slug'},
      },
    });

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
    render(
      <OrgDashboards
        api={api}
        location={LocationFixture()}
        organization={initialData.organization}
        params={{orgId: 'org-slug', dashboardId: '1'}}
      >
        {({dashboard, dashboards}) => {
          return dashboard ? (
            <DashboardDetail
              api={api}
              initialState={DashboardState.VIEW}
              location={initialData.routerContext.location}
              router={initialData.router}
              dashboard={dashboard}
              dashboards={dashboards}
              {...initialData.router}
            />
          ) : (
            <div>loading</div>
          );
        }}
      </OrgDashboards>,
      {context: initialData.routerContext}
    );

    await waitFor(() =>
      expect(browserHistory.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            project: [1, 2],
            environment: ['alpha'],
            statsPeriod: '7d',
          }),
        })
      )
    );
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
    render(
      <OrgDashboards
        api={api}
        location={{
          ...LocationFixture(),
          query: {
            // This query param is not a page filter, so it should not interfere
            // with the redirect logic
            sort: 'recentlyViewed',
          },
        }}
        organization={initialData.organization}
        params={{orgId: 'org-slug', dashboardId: '1'}}
      >
        {({dashboard, dashboards}) => {
          return dashboard ? (
            <DashboardDetail
              api={api}
              initialState={DashboardState.VIEW}
              location={initialData.router.location}
              router={initialData.router}
              dashboard={dashboard}
              dashboards={dashboards}
              {...initialData.router}
            />
          ) : (
            <div>loading</div>
          );
        }}
      </OrgDashboards>,
      {context: initialData.routerContext}
    );

    await waitFor(() =>
      expect(browserHistory.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            project: [1, 2],
            environment: ['alpha'],
            statsPeriod: '7d',
          }),
        })
      )
    );
  });

  it('does not add query params for page filters if one of the filters is defined', () => {
    initialData = initializeOrg({
      organization,
      projects: [],
      router: {
        location: {
          ...LocationFixture(),
          query: {
            // project is supplied in the URL, so we should avoid redirecting
            project: ['1'],
          },
        },
        params: {orgId: 'org-slug'},
      },
    });
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
    render(
      <OrgDashboards
        api={api}
        location={initialData.router.location}
        organization={initialData.organization}
        params={{orgId: 'org-slug', dashboardId: '1'}}
      >
        {({dashboard, dashboards}) => {
          return dashboard ? (
            <DashboardDetail
              api={api}
              initialState={DashboardState.VIEW}
              location={initialData.router.location}
              router={initialData.router}
              dashboard={dashboard}
              dashboards={dashboards}
              {...initialData.router}
            />
          ) : (
            <div>loading</div>
          );
        }}
      </OrgDashboards>,
      {context: initialData.routerContext}
    );

    expect(browserHistory.replace).not.toHaveBeenCalled();
  });

  it('does not add query params for page filters if none are saved', () => {
    render(
      <OrgDashboards
        api={api}
        location={LocationFixture()}
        organization={initialData.organization}
        params={{orgId: 'org-slug', dashboardId: '1'}}
      >
        {({dashboard, dashboards}) => {
          return dashboard ? (
            <DashboardDetail
              api={api}
              initialState={DashboardState.VIEW}
              location={initialData.routerContext.location}
              router={initialData.router}
              dashboard={dashboard}
              dashboards={dashboards}
              {...initialData.router}
            />
          ) : (
            <div>loading</div>
          );
        }}
      </OrgDashboards>,
      {context: initialData.routerContext}
    );

    expect(browserHistory.replace).not.toHaveBeenCalled();
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
    const {rerender} = render(
      <OrgDashboards
        api={api}
        location={LocationFixture()}
        organization={initialData.organization}
        params={{orgId: 'org-slug', dashboardId: '1'}}
      >
        {({dashboard, dashboards}) => {
          return dashboard ? (
            <DashboardDetail
              api={api}
              initialState={DashboardState.VIEW}
              location={initialData.routerContext.location}
              router={initialData.router}
              dashboard={dashboard}
              dashboards={dashboards}
              {...initialData.router}
            />
          ) : (
            <div>loading</div>
          );
        }}
      </OrgDashboards>,
      {context: initialData.routerContext}
    );

    await waitFor(() => expect(browserHistory.replace).toHaveBeenCalledTimes(1));

    rerender(
      <OrgDashboards
        api={api}
        location={{...initialData.routerContext.location, query: {}}}
        organization={initialData.organization}
        params={{orgId: 'org-slug', dashboardId: '1'}}
      >
        {({dashboard, dashboards}) => {
          return dashboard ? (
            <DashboardDetail
              api={api}
              initialState={DashboardState.VIEW}
              location={initialData.routerContext.location}
              router={initialData.router}
              dashboard={dashboard}
              dashboards={dashboards}
              {...initialData.router}
            />
          ) : (
            <div>loading</div>
          );
        }}
      </OrgDashboards>
    );

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(browserHistory.replace).toHaveBeenCalledTimes(1);
  });
});
