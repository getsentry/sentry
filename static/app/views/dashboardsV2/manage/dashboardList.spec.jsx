import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import DashboardList from 'sentry/views/dashboardsV2/manage/dashboardList';

describe('Dashboards > DashboardList', function () {
  let dashboards, widgets, deleteMock, dashboardUpdateMock, createMock;
  const organization = TestStubs.Organization({
    features: ['global-views', 'dashboards-basic', 'dashboards-edit', 'discover-query'],
    projects: [TestStubs.Project()],
  });

  const {router, routerContext} = initializeOrg();

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    widgets = [
      TestStubs.Widget(
        [{name: '', conditions: 'event.type:error', fields: ['count()']}],
        {
          title: 'Errors',
          interval: '1d',
          id: '1',
        }
      ),
      TestStubs.Widget(
        [{name: '', conditions: 'event.type:transaction', fields: ['count()']}],
        {
          title: 'Transactions',
          interval: '1d',
          id: '2',
        }
      ),
      TestStubs.Widget(
        [
          {
            name: '',
            conditions: 'event.type:transaction transaction:/api/cats',
            fields: ['p50()'],
          },
        ],
        {
          title: 'p50 of /api/cats',
          interval: '1d',
          id: '3',
        }
      ),
    ];
    dashboards = [
      TestStubs.Dashboard([], {
        id: '1',
        title: 'Dashboard 1',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: {id: '1'},
        widgetPreview: [],
      }),
      TestStubs.Dashboard(widgets, {
        id: '2',
        title: 'Dashboard 2',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: {id: '1'},
        widgetPreview: [
          {
            displayType: 'line',
            layout: {},
          },
          {
            displayType: 'table',
            layout: {},
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
        organization={organization}
        dashboards={dashboards}
        pageLinks=""
        location={{query: {statsPeriod: '7d'}}}
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
        location={{query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />,
      {context: routerContext}
    );
    renderGlobalModal();

    userEvent.click(screen.getAllByRole('button', {name: /dashboard actions/i})[1]);
    userEvent.click(screen.getByTestId('dashboard-delete'));

    expect(deleteMock).not.toHaveBeenCalled();

    userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: /confirm/i})
    );

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
      expect(dashboardUpdateMock).toHaveBeenCalled();
    });
  });

  it('cannot delete last dashboard', function () {
    const singleDashboard = [
      TestStubs.Dashboard([], {
        id: '1',
        title: 'Dashboard 1',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: {id: '1'},
        widgetPreview: [],
      }),
    ];
    render(
      <DashboardList
        organization={organization}
        dashboards={singleDashboard}
        pageLinks=""
        location={{query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />
    );

    userEvent.click(screen.getByRole('button', {name: /dashboard actions/i}));
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
        location={{query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />
    );

    userEvent.click(screen.getAllByRole('button', {name: /dashboard actions/i})[1]);
    userEvent.click(screen.getByTestId('dashboard-duplicate'));

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
        location={{query: {}}}
        onDashboardsChange={dashboardUpdateMock}
      />
    );

    userEvent.click(screen.getAllByRole('button', {name: /dashboard actions/i})[1]);
    userEvent.click(screen.getByTestId('dashboard-duplicate'));

    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
      // Should not update, and not throw error
      expect(dashboardUpdateMock).not.toHaveBeenCalled();
    });
  });
});
