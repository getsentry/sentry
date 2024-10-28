import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EditAccessSelector from './editAccessSelector';

function renderTestComponent(
  initialData,
  mockDashboard = DashboardFixture([], {
    id: '1',
    createdBy: UserFixture({id: '1'}),
    title: 'Custom Errors',
  })
) {
  render(
    <EditAccessSelector dashboard={mockDashboard} onChangeEditAccess={jest.fn()} />,
    {
      router: initialData.router,
      organization: {
        user: UserFixture({id: '1'}),
        features: ['dashboards-edit-access', 'dashboards-edit'],
        ...initialData.organization,
      },
    }
  );
}

describe('When EditAccessSelector is rendered', () => {
  let initialData;
  const organization = OrganizationFixture({});
  beforeEach(() => {
    window.confirm = jest.fn();

    initialData = initializeOrg({
      organization,
      router: {
        location: LocationFixture(),
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {
          ...DashboardFixture([], {
            id: 'default-overview',
            title: 'Default',
          }),
        },
        {
          ...DashboardFixture([], {
            id: '1',
            title: 'test dashboard 2',
          }),
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      body: DashboardFixture([], {
        id: '1',
        title: 'Custom Errors',
        filters: {},
      }),
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders with creator and everyone options', async function () {
    renderTestComponent(initialData);

    await userEvent.click(await screen.findByText('Edit Access:'));
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('Everyone')).toBeInTheDocument();
  });

  it('renders All badge when dashboards has no perms defined', async function () {
    renderTestComponent(initialData);
    await userEvent.click(await screen.findByText('Edit Access:'));
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders All badge when dashboards everyone is selected', async function () {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1'}),
      title: 'Custom Errors',
      permissions: {isCreatorOnlyEditable: false}, // set to false
    });
    renderTestComponent(initialData, mockDashboard);
    await screen.findByText('Edit Access:');
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders User badge when creator only is selected', async function () {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1'}),
      title: 'Custom Errors',
      permissions: {isCreatorOnlyEditable: true}, // set to true
    });
    renderTestComponent(initialData, mockDashboard);
    await screen.findByText('Edit Access:');
    expect(screen.getByText('FB')).toBeInTheDocument(); // current User's initials
    expect(screen.queryByText('All')).not.toBeInTheDocument();
  });

  it('disables edit dashboard and add widget buttons when user does not have edit perms', async function () {});

  // it('makes a post request onchange with success message', async function () {
  //   const mockPOST = MockApiClient.addMockResponse({
  //     url: '/organizations/org-slug/dashboards/',
  //     method: 'POST',
  //     body: [],
  //   });
  //   renderTestComponent(initialData);
  //   await userEvent.click(await screen.findByText('Edit Access:'));
  //   await userEvent.click(await screen.findByText('Everyone'));
  //   // Click out to trigger onChange
  //   await userEvent.click(await screen.findByText('Edit Access:'));
  //   await screen.findByText('Dashboard Edit Access updated.');
  //   expect(mockPOST).toHaveBeenCalledWith(
  //     '/organizations/org-slug/dashboards/'
  //     // expect.objectContaining({
  //     //   data: expect.objectContaining({
  //     //     projects: [2],
  //     //     environment: ['alpha', 'beta'],
  //     //     period: '7d',
  //     //   }),
  //     // })
  //   );
  // });

  // [WIP] (Teams based access)
  it('renders all teams', async function () {});
  it('selects all teams when everyone is selected', async function () {});
  it('makes a post request with success message when different teams are selected', async function () {});
});
