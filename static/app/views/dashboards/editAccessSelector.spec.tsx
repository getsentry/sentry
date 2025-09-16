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

  it('renders with creator and everyone options', async () => {
    renderTestComponent();

    await userEvent.click(await screen.findByText('Editors:'));
    expect(screen.getByText('Creator')).toBeInTheDocument();
    expect(screen.getByText('Select All')).toBeInTheDocument();
  });

  it('renders All badge when dashboards has no perms defined', async () => {
    renderTestComponent();
    await userEvent.click(await screen.findByText('Editors:'));
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders All badge when perms is set to everyone', async () => {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1'}),
      title: 'Custom Errors',
      permissions: {isEditableByEveryone: true}, // set to true
    });
    renderTestComponent(mockDashboard);
    await screen.findByText('Editors:');
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders All badge when Select All is selected', async () => {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1'}),
      title: 'Custom Errors',
      permissions: {isEditableByEveryone: false}, // set to false
    });
    renderTestComponent(mockDashboard);
    await userEvent.click(await screen.findByText('Editors:'));

    expect(screen.queryByText('All')).not.toBeInTheDocument();

    // Select everyone
    expect(await screen.findByRole('option', {name: 'Select All'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
    await userEvent.click(screen.getByRole('option', {name: 'Select All'}));
    expect(await screen.findByRole('option', {name: 'Select All'})).toHaveAttribute(
      'aria-selected',
      'true'
    );

    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders User badge when creator-only is selected', async () => {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1', name: 'Lorem Ipsum'}),
      title: 'Custom Errors',
      permissions: {isEditableByEveryone: false}, // set to false
    });
    renderTestComponent(mockDashboard);
    await screen.findByText('Editors:');
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

describe('When EditAccessSelector is rendered with Teams', () => {
  const teams = teamData.map(data => TeamFixture(data));

  beforeEach(() => {
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

  it('renders all teams', async () => {
    renderTestComponent();
    await userEvent.click(await screen.findByText('Editors:'));

    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('#team1')).toBeInTheDocument();
    expect(screen.getByText('#team2')).toBeInTheDocument();
    expect(screen.getByText('#team3')).toBeInTheDocument();
  });

  it('selects all teams when Select All is selected', async () => {
    const mockDashboard = DashboardFixture([], {
      id: '1',
      createdBy: UserFixture({id: '1'}),
      title: 'Custom Errors',
      permissions: {isEditableByEveryone: false}, // set to false
    });
    renderTestComponent(mockDashboard);
    await userEvent.click(await screen.findByText('Editors:'));

    expect(await screen.findByRole('option', {name: '#team1'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(await screen.findByRole('option', {name: '#team2'})).toHaveAttribute(
      'aria-selected',
      'false'
    );

    // Select everyone
    expect(await screen.findByRole('option', {name: 'Select All'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
    await userEvent.click(screen.getByRole('option', {name: 'Select All'}));
    expect(await screen.findByRole('option', {name: 'Select All'})).toHaveAttribute(
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

  it('searches teams', async () => {
    const org = OrganizationFixture();
    OrganizationStore.onUpdate(org, {replace: true});
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/teams/`,
      method: 'GET',
      body: teams,
    });
    renderTestComponent();

    await userEvent.click(await screen.findByText('Editors:'));
    await userEvent.type(screen.getByPlaceholderText('Search Teams'), 'team2');

    expect(screen.getByText('#team2')).toBeInTheDocument();
  });
});
