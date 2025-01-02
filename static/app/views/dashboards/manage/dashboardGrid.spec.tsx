import {DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import DashboardGrid from 'sentry/views/dashboards/manage/dashboardGrid';
import {type DashboardListItem, DisplayType} from 'sentry/views/dashboards/types';

describe('Dashboards - DashboardGrid', function () {
  let dashboards: DashboardListItem[];
  let deleteMock: jest.Mock;
  let dashboardUpdateMock: jest.Mock;
  let createMock: jest.Mock;
  const organization = OrganizationFixture({
    features: ['global-views', 'dashboards-basic', 'dashboards-edit', 'discover-query'],
  });

  const {router} = initializeOrg();

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

  it('renders an empty list', async function () {
    render(
      <DashboardGrid
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={[]}
        location={router.location}
        columnCount={3}
        rowCount={3}
      />
    );

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(
      await screen.findByText('Sorry, no Dashboards match your filters.')
    ).toBeInTheDocument();
  });

  it('renders dashboard list', function () {
    render(
      <DashboardGrid
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={dashboards}
        location={router.location}
        columnCount={3}
        rowCount={3}
      />
    );

    expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Dashboard 2')).toBeInTheDocument();
  });

  it('returns landing page url for dashboards', function () {
    render(
      <DashboardGrid
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={dashboards}
        location={router.location}
        columnCount={3}
        rowCount={3}
      />,
      {router}
    );

    expect(screen.getByRole('link', {name: 'Dashboard 1'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboard/1/'
    );
    expect(screen.getByRole('link', {name: 'Dashboard 2'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboard/2/'
    );
  });

  it('persists global selection headers', function () {
    render(
      <DashboardGrid
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={dashboards}
        location={{...LocationFixture(), query: {statsPeriod: '7d'}}}
        columnCount={3}
        rowCount={3}
      />,
      {router}
    );

    expect(screen.getByRole('link', {name: 'Dashboard 1'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboard/1/?statsPeriod=7d'
    );
  });

  it('can delete dashboards', async function () {
    render(
      <DashboardGrid
        organization={organization}
        dashboards={dashboards}
        location={{...LocationFixture(), query: {}}}
        onDashboardsChange={dashboardUpdateMock}
        columnCount={3}
        rowCount={3}
      />,
      {router}
    );
    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {name: /dashboard actions/i})[1]!
    );
    await userEvent.click(screen.getByTestId('dashboard-delete'));

    expect(deleteMock).not.toHaveBeenCalled();

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: /confirm/i})
    );

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalled();
    });
    expect(dashboardUpdateMock).toHaveBeenCalled();
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
      <DashboardGrid
        organization={organization}
        dashboards={singleDashboard}
        location={LocationFixture()}
        onDashboardsChange={dashboardUpdateMock}
        columnCount={3}
        rowCount={3}
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
      <DashboardGrid
        organization={organization}
        dashboards={dashboards}
        location={{...LocationFixture(), query: {}}}
        onDashboardsChange={dashboardUpdateMock}
        columnCount={3}
        rowCount={3}
      />
    );
    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {name: /dashboard actions/i})[1]!
    );
    await userEvent.click(screen.getByTestId('dashboard-duplicate'));

    expect(createMock).not.toHaveBeenCalled();

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: /confirm/i})
    );

    await waitFor(() => {
      expect(createMock).toHaveBeenCalled();
    });
    expect(dashboardUpdateMock).toHaveBeenCalled();
  });

  it('does not throw an error if the POST fails during duplication', async function () {
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      method: 'POST',
      statusCode: 404,
    });

    render(
      <DashboardGrid
        organization={organization}
        dashboards={dashboards}
        location={{...LocationFixture(), query: {}}}
        onDashboardsChange={dashboardUpdateMock}
        columnCount={3}
        rowCount={3}
      />
    );
    renderGlobalModal();

    await userEvent.click(
      screen.getAllByRole('button', {name: /dashboard actions/i})[1]!
    );
    await userEvent.click(screen.getByTestId('dashboard-duplicate'));

    expect(postMock).not.toHaveBeenCalled();

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: /confirm/i})
    );

    await waitFor(() => {
      expect(postMock).toHaveBeenCalled();
    });
    // Should not update, and not throw error
    expect(dashboardUpdateMock).not.toHaveBeenCalled();
  });

  it('renders favorite and unfavorite buttons on cards', function () {
    dashboards = [
      DashboardListItemFixture({
        id: '1',
        title: 'Dashboard 1',
        createdBy: UserFixture({id: '1'}),
        isFavorited: true,
      }),
      DashboardListItemFixture({
        id: '2',
        title: 'Dashboard 2',
        createdBy: UserFixture({id: '1'}),
        isFavorited: false,
      }),
    ];
    render(
      <DashboardGrid
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={dashboards}
        location={router.location}
        columnCount={3}
        rowCount={3}
      />,
      {
        router,
        organization: {
          features: ['dashboards-favourite', ...organization.features],
        },
      }
    );

    expect(screen.queryAllByLabelText('Dashboards Favorite')).toHaveLength(2);
    expect(screen.queryAllByLabelText('Favorite')).toHaveLength(1);
    expect(screen.queryAllByLabelText('UnFavorite')).toHaveLength(1);
  });

  it('makes PUT requests when favoriting', async function () {
    const putMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/2/favorite/',
      method: 'PUT',
      body: {isFavorited: false},
    });

    dashboards = [
      DashboardListItemFixture({
        id: '1',
        title: 'Dashboard 1',
        createdBy: UserFixture({id: '1'}),
        isFavorited: true,
      }),
      DashboardListItemFixture({
        id: '2',
        title: 'Dashboard 2',
        createdBy: UserFixture({id: '1'}),
        isFavorited: false,
      }),
    ];

    render(
      <DashboardGrid
        onDashboardsChange={jest.fn()}
        organization={organization}
        dashboards={dashboards}
        location={router.location}
        columnCount={3}
        rowCount={3}
      />,
      {
        router,
        organization: {
          features: ['dashboards-favourite', ...organization.features],
        },
      }
    );

    expect(screen.queryAllByLabelText('Favorite')).toHaveLength(1);
    const favoriteButton = screen.queryAllByLabelText('Favorite')[0]!;
    await userEvent.click(favoriteButton);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalled();
    });

    expect(screen.queryAllByLabelText('Favorite')).toHaveLength(0);
  });
});
