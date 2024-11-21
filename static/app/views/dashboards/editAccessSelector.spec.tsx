import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import EditAccessSelector from 'sentry/views/dashboards/editAccessSelector';

function renderTestComponent(
  mockDashboard = DashboardFixture([], {
    id: '1',
    title: 'test dashboard 2',
    createdBy: UserFixture({id: '35478'}),
  })
) {
  render(<EditAccessSelector dashboard={mockDashboard} onChangeEditAccess={jest.fn()} />);
}

describe('When EditAccessSelector is rendered with no Teams', () => {
  beforeEach(() => {
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
    renderTestComponent();

    await userEvent.click(await screen.findByText('Edit Access:'));
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('All users')).toBeInTheDocument();
  });

  it('renders All badge when dashboards has no perms defined', async function () {
    renderTestComponent();
    await userEvent.click(await screen.findByText('Edit Access:'));
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders All badge when perms is set to everyone', async function () {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1'}),
      title: 'Custom Errors',
      permissions: {isEditableByEveryone: true}, // set to true
    });
    renderTestComponent(mockDashboard);
    await screen.findByText('Edit Access:');
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders All badge when All users is selected', async function () {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1'}),
      title: 'Custom Errors',
      permissions: {isEditableByEveryone: false}, // set to false
    });
    renderTestComponent(mockDashboard);
    await userEvent.click(await screen.findByText('Edit Access:'));

    expect(screen.queryByText('All')).not.toBeInTheDocument();

    // Select everyone
    expect(await screen.findByRole('option', {name: 'All users'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
    await userEvent.click(screen.getByRole('option', {name: 'All users'}));
    expect(await screen.findByRole('option', {name: 'All users'})).toHaveAttribute(
      'aria-selected',
      'true'
    );

    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders User badge when creator-only is selected', async function () {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1', name: 'Lorem Ipsum'}),
      title: 'Custom Errors',
      permissions: {isEditableByEveryone: false}, // set to false
    });
    renderTestComponent(mockDashboard);
    await screen.findByText('Edit Access:');
    expect(screen.getByText('LI')).toBeInTheDocument(); // dashboard owner's initials
    expect(screen.queryByText('All')).not.toBeInTheDocument();
  });
});

const teamData = [
  {
    id: '1',
    slug: 'team1',
    name: 'Team 1',
  },
  {
    id: '2',
    slug: 'team2',
    name: 'Team 2',
  },
  {
    id: '3',
    slug: 'team3',
    name: 'Team 3',
  },
];

describe('When EditAccessSelector is rendered with Teams', function () {
  const teams = teamData.map(data => TeamFixture(data));

  beforeEach(function () {
    TeamStore.loadInitialData(teams);
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

  it('renders all teams', async function () {
    renderTestComponent();
    await userEvent.click(await screen.findByText('Edit Access:'));

    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('#team1')).toBeInTheDocument();
    expect(screen.getByText('#team2')).toBeInTheDocument();
    expect(screen.getByText('#team3')).toBeInTheDocument();
  });

  it('selects all teams when all users is selected', async function () {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1'}),
      title: 'Custom Errors',
      permissions: {isEditableByEveryone: false}, // set to false
    });
    renderTestComponent(mockDashboard);
    await userEvent.click(await screen.findByText('Edit Access:'));

    expect(await screen.findByRole('option', {name: '#team1'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(await screen.findByRole('option', {name: '#team2'})).toHaveAttribute(
      'aria-selected',
      'false'
    );

    // Select everyone
    expect(await screen.findByRole('option', {name: 'All users'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
    await userEvent.click(screen.getByRole('option', {name: 'All users'}));
    expect(await screen.findByRole('option', {name: 'All users'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await screen.findByRole('option', {name: '#team1'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(await screen.findByRole('option', {name: '#team2'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('searches teams', async function () {
    const org = OrganizationFixture();
    OrganizationStore.onUpdate(org, {replace: true});
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/teams/`,
      method: 'GET',
      body: teams,
    });
    renderTestComponent();

    await userEvent.click(await screen.findByText('Edit Access:'));
    await userEvent.type(screen.getByPlaceholderText('Search Teams'), 'team2');

    expect(screen.getByText('#team2')).toBeInTheDocument();
  });
});
