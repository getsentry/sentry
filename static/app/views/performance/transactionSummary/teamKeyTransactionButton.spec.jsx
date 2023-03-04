import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import EventView from 'sentry/utils/discover/eventView';
import {MAX_TEAM_KEY_TRANSACTIONS} from 'sentry/utils/performance/constants';
import TeamKeyTransactionButton from 'sentry/views/performance/transactionSummary/teamKeyTransactionButton';

async function clickTeamKeyTransactionDropdown() {
  await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
  await userEvent.click(screen.getByRole('button'));
}

describe('TeamKeyTransactionButton', function () {
  const organization = TestStubs.Organization({features: ['performance-view']});
  const teams = [
    TestStubs.Team({id: '1', slug: 'team1', name: 'Team 1'}),
    TestStubs.Team({id: '2', slug: 'team2', name: 'Team 2'}),
  ];
  const project = TestStubs.Project({teams});
  const eventView = new EventView({
    id: '1',
    name: 'my query',
    fields: [{field: 'count()'}],
    sorts: [{field: 'count', kind: 'desc'}],
    query: '',
    project: [project.id],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: [],
  });

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
    act(() => void TeamStore.loadInitialData(teams, false, null));
  });

  it('fetches key transactions with project param', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: 1,
        keyed: [{project_id: String(project.id), transaction: 'transaction'}],
      })),
      match: [MockApiClient.matchQuery({project: [project.id], team: ['myteams']})],
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    expect(getTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('renders with all teams checked', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: 1,
        keyed: [{project_id: String(project.id), transaction: 'transaction'}],
      })),
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await clickTeamKeyTransactionDropdown();

    // header should show the checked state
    expect(screen.getByRole('checkbox', {name: 'My Teams with Access'})).toBeChecked();

    // all teams should be checked
    expect(screen.getByRole('checkbox', {name: teams[0].slug})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: teams[1].slug})).toBeChecked();
  });

  it('renders with some teams checked', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: id === teams[0].id ? 1 : 0,
        keyed:
          id === teams[0].id
            ? [{project_id: String(project.id), transaction: 'transaction'}]
            : [],
      })),
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await clickTeamKeyTransactionDropdown();

    // header should show the indeterminate state
    expect(
      screen.getByRole('checkbox', {name: 'My Teams with Access'})
    ).toBePartiallyChecked();

    // only team 1 should be checked
    expect(screen.getByRole('checkbox', {name: teams[0].slug})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: teams[1].slug})).not.toBeChecked();
  });

  it('renders with no teams checked', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: 0,
        keyed: [],
      })),
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await clickTeamKeyTransactionDropdown();

    // header should show the unchecked state
    expect(
      screen.getByRole('checkbox', {name: 'My Teams with Access'})
    ).not.toBeChecked();

    // all teams should be unchecked
    expect(screen.getByRole('checkbox', {name: teams[0].slug})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: teams[1].slug})).not.toBeChecked();
  });

  it('should be able to check one team', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: 0,
        keyed: [],
      })),
    });

    const postTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: '/organizations/org-slug/key-transactions/',
      body: [],
      match: [
        MockApiClient.matchQuery({project: [project.id]}),
        MockApiClient.matchData({team: [teams[0].id], transaction: 'transaction'}),
      ],
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await clickTeamKeyTransactionDropdown();

    await userEvent.click(screen.getByRole('checkbox', {name: teams[0].slug}));
    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('should be able to uncheck one team', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: 1,
        keyed: [{project_id: String(project.id), transaction: 'transaction'}],
      })),
    });

    const deleteTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: '/organizations/org-slug/key-transactions/',
      body: [],
      match: [
        MockApiClient.matchQuery({project: [project.id]}),
        MockApiClient.matchData({team: [teams[0].id], transaction: 'transaction'}),
      ],
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await clickTeamKeyTransactionDropdown();

    await userEvent.click(screen.getByRole('checkbox', {name: teams[0].slug}));
    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('should be able to check all with my teams', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: 0,
        keyed: [],
      })),
    });

    const postTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: '/organizations/org-slug/key-transactions/',
      body: [],
      match: [
        MockApiClient.matchQuery({project: [project.id]}),
        MockApiClient.matchData({
          team: [teams[0].id, teams[1].id],
          transaction: 'transaction',
        }),
      ],
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await clickTeamKeyTransactionDropdown();

    await userEvent.click(screen.getByRole('checkbox', {name: 'My Teams with Access'}));

    // all teams should be checked now
    await waitFor(() => {
      expect(screen.getByRole('checkbox', {name: teams[0].slug})).toBeChecked();
      expect(screen.getByRole('checkbox', {name: teams[1].slug})).toBeChecked();
    });

    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('should be able to uncheck all with my teams', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: 1,
        keyed: [{project_id: String(project.id), transaction: 'transaction'}],
      })),
    });

    const deleteTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'DELETE',
      url: '/organizations/org-slug/key-transactions/',
      body: [],
      match: [
        MockApiClient.matchQuery({project: [project.id]}),
        MockApiClient.matchData({
          team: [teams[0].id, teams[1].id],
          transaction: 'transaction',
        }),
      ],
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await clickTeamKeyTransactionDropdown();

    await userEvent.click(screen.getByRole('checkbox', {name: 'My Teams with Access'}));

    // all teams should be unchecked now
    await waitFor(() => {
      expect(screen.getByRole('checkbox', {name: teams[0].slug})).not.toBeChecked();
      expect(screen.getByRole('checkbox', {name: teams[1].slug})).not.toBeChecked();
    });

    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('renders unkeyed as disabled if count exceeds max', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: MAX_TEAM_KEY_TRANSACTIONS,
        keyed: Array.from({length: MAX_TEAM_KEY_TRANSACTIONS}, (_, i) => ({
          project_id: String(project.id),
          transaction: `transaction-${i}`,
        })),
      })),
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await clickTeamKeyTransactionDropdown();

    expect(
      screen.getByRole('button', {
        name: `${teams[0].slug} Max ${MAX_TEAM_KEY_TRANSACTIONS}`,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {
        name: `${teams[1].slug} Max ${MAX_TEAM_KEY_TRANSACTIONS}`,
      })
    ).toBeInTheDocument();
  });

  it('renders keyed as checked even if count is maxed', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions-list/',
      body: teams.map(({id}) => ({
        team: id,
        count: MAX_TEAM_KEY_TRANSACTIONS,
        keyed: [
          {project_id: String(project.id), transaction: 'transaction'},
          ...Array.from({length: MAX_TEAM_KEY_TRANSACTIONS - 1}, (_, i) => ({
            project_id: String(project.id),
            transaction: `transaction-${i}`,
          })),
        ],
      })),
    });

    render(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await clickTeamKeyTransactionDropdown();

    expect(screen.getByRole('checkbox', {name: teams[0].slug})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: teams[1].slug})).toBeChecked();
  });
});
