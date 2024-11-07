import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import EditAccessSelector from './editAccessSelector';

function renderTestComponent(
  initialData,
  mockDashboard = DashboardFixture([], {
    id: '1',
    title: 'test dashboard 2',
    createdBy: UserFixture({id: '35478'}),
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
            createdBy: UserFixture({id: '35478'}),
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

  it('renders All badge when perms is set to everyone', async function () {
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

  it('renders All badge when everyone is selected', async function () {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1'}),
      title: 'Custom Errors',
      permissions: {isCreatorOnlyEditable: true}, // set to false
    });
    renderTestComponent(initialData, mockDashboard);
    await userEvent.click(await screen.findByText('Edit Access:'));

    expect(screen.queryByText('All')).not.toBeInTheDocument();

    // Select everyone
    expect(await screen.findByRole('option', {name: 'Everyone'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
    await userEvent.click(screen.getByRole('option', {name: 'Everyone'}));
    expect(await screen.findByRole('option', {name: 'Everyone'})).toHaveAttribute(
      'aria-selected',
      'true'
    );

    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders User badge when creator-only is selected', async function () {
    const currentUser = UserFixture({id: '781629', name: 'John Doe'});
    ConfigStore.set('user', currentUser);

    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1', name: 'Lorem Ipsum'}),
      title: 'Custom Errors',
      permissions: {isCreatorOnlyEditable: true}, // set to true
    });
    renderTestComponent(initialData, mockDashboard);
    await screen.findByText('Edit Access:');
    expect(screen.getByText('LI')).toBeInTheDocument(); // dashboard owner's initials
    expect(screen.queryByText('All')).not.toBeInTheDocument();
  });

  it('disables dropdown options when current user is not dashboard creator', async function () {
    const currentUser = UserFixture({id: '781629'});
    ConfigStore.set('user', currentUser);

    renderTestComponent(initialData);
    await userEvent.click(await screen.findByText('Edit Access:'));

    // Everyone option should be disabled
    expect(await screen.findByRole('option', {name: 'Everyone'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await userEvent.click(screen.getByRole('option', {name: 'Everyone'}));
    expect(await screen.findByRole('option', {name: 'Everyone'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  // [WIP] (Teams based access)
  it('renders all teams', async function () {});
  it('selects all teams when everyone is selected', async function () {});
  it('retains team selection on re-opening selector', async function () {});
  it('makes a post request with success message when different teams are selected', async function () {});
});
