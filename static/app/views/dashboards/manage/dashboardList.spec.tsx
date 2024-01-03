import {DashboardListItem as DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {User as UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import DashboardList from 'sentry/views/dashboards/manage/dashboardList';
import {DisplayType} from 'sentry/views/dashboards/types';

describe('Dashboards - DashboardList', function () {
  let dashboards, deleteMock, dashboardUpdateMock, createMock;
  const organization = Organization({
    features: ['global-views', 'dashboards-basic', 'dashboards-edit', 'discover-query'],
    projects: [ProjectFixture()],
  });

  const {router, routerContext} = initializeOrg();

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    dashboards = [
      DashboardListItemFixture({
        id: '1',
        title: 'Dashboard 1',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: UserFixture({id: '1'}),
      }),
      DashboardListItemFixture({
        id: '2',
        title: 'Dashboard 2',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: UserFixture({id: '1'}),
        widgetPreview: [
          {
            displayType: DisplayType.LINE,
            layout: null,
          },
          {
            displayType: DisplayType.TABLE,
            layout: null,
          },
        ],
      }),
    ];
    deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/2/',
      method: 'DELETE',
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/2/',
      method: 'GET',
      statusCode: 200,
      body: {
        id: '2',
        title: 'Dashboard Demo',
        widgets: [
          {
            id: '1',
            title: 'Errors',
            displayType: 'big_number',
            interval: '5m',
          },
          {
            id: '2',
            title: 'Transactions',
            displayType: 'big_number',
            interval: '5m',
          },
          {
            id: '3',
            title: 'p50 of /api/cat',
            displayType: 'big_number',
            interval: '5m',
          },
        ],
      },
    });
    createMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      method: 'POST',
      statusCode: 200,
    });
    dashboardUpdateMock = jest.fn();
  });

  it('renders an empty list', function () {
    render(
      <DashboardList
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={[]}
        pageLinks=""
        location={router.location}
      />
    );

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders dashboard list', function () {
    render(
      <DashboardList
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={router.location}
      />
    );

    expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Dashboard 2')).toBeInTheDocument();
  });

  it('returns landing page url for dashboards', function () {
    render(
      <DashboardList
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={router.location}
      />,
      {context: routerContext}
    );

    expect(screen.getByRole('link', {name: 'Dashboard 1'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboard/1/?'
    );
    expect(screen.getByRole('link', {name: 'Dashboard 2'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboard/2/?'
    );
  });

  it('persists global selection headers', function () {
    render(
      <DashboardList
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{...LocationFixture(), query: {statsPeriod: '7d'}}}
      />,
      {context: routerContext}
    );

    expect(screen.getByRole('link', {name: 'Dashboard 1'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboard/1/?statsPeriod=7d'
    );
  });

  it('can delete dashboards', async function () {
    render(
      <DashboardList
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{...LocationFixture(), query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />,
      {context: routerContext}
    );
    renderGlobalModal();

    await userEvent.click(screen.getAllByRole('button', {name: /dashboard actions/i})[1]);
    await userEvent.click(screen.getByTestId('dashboard-delete'));

    expect(deleteMock).not.toHaveBeenCalled();

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: /confirm/i})
    );

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
      expect(dashboardUpdateMock).toHaveBeenCalled();
    });
  });

  it('cannot delete last dashboard', async function () {
    const singleDashboard = [
      DashboardListItemFixture({
        id: '1',
        title: 'Dashboard 1',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: UserFixture({id: '1'}),
        widgetPreview: [],
      }),
    ];
    render(
      <DashboardList
        organization={organization}
        dashboards={singleDashboard}
        pageLinks=""
        location={LocationFixture()}
        onDashboardsChange={dashboardUpdateMock}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /dashboard actions/i}));
    expect(screen.getByTestId('dashboard-delete')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('can duplicate dashboards', async function () {
    render(
      <DashboardList
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{...LocationFixture(), query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />
    );

    await userEvent.click(screen.getAllByRole('button', {name: /dashboard actions/i})[1]);
    await userEvent.click(screen.getByTestId('dashboard-duplicate'));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled();
      expect(dashboardUpdateMock).toHaveBeenCalled();
    });
  });

  it('does not throw an error if the POST fails during duplication', async function () {
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      method: 'POST',
      statusCode: 404,
    });

    render(
      <DashboardList
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{...LocationFixture(), query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />
    );

    await userEvent.click(screen.getAllByRole('button', {name: /dashboard actions/i})[1]);
    await userEvent.click(screen.getByTestId('dashboard-duplicate'));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
      // Should not update, and not throw error
      expect(dashboardUpdateMock).not.toHaveBeenCalled();
    });
  });
});
