import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import DashboardDetail from 'sentry/views/dashboardsV2/detail';
import OrgDashboards from 'sentry/views/dashboardsV2/orgDashboards';
import {DashboardState} from 'sentry/views/dashboardsV2/types';

describe('OrgDashboards', () => {
  const api = new MockApiClient();
  const organization = TestStubs.Organization({
    features: ['dashboards-basic', 'dashboards-edit', 'dashboards-top-level-filter'],
  });

  let initialData;
  beforeEach(() => {
    initialData = initializeOrg({
      organization,
      project: 1,
      projects: [],
      router: {
        location: TestStubs.location(),
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
        location={TestStubs.location()}
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

  it('does not add query params for page filters if none are saved', () => {
    render(
      <OrgDashboards
        api={api}
        location={TestStubs.location()}
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
});
