import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import TeamKeyTransactionField from 'sentry/utils/discover/teamKeyTransactionField';

describe('TeamKeyTransactionField', function () {
  const organization = TestStubs.Organization();
  const teams = [
    TestStubs.Team({id: '1', slug: 'team1', name: 'Team 1'}),
    TestStubs.Team({id: '2', slug: 'team2', name: 'Team 2'}),
  ];
  const project = TestStubs.Project({teams});

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.loadInitialData([project]));
    act(() => TeamStore.loadInitialData(teams));
  });

  it('renders with all teams checked', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        count: 1,
        keyed: [{project_id: String(project.id), transaction: 'transaction'}],
      })),
    });

    render(
      <TeamKeyTransactionManager.Provider
        organization={organization}
        teams={teams}
        selectedTeams={['myteams']}
      >
        <TeamKeyTransactionField
          isKeyTransaction
          organization={organization}
          projectSlug={project.slug}
          transactionName="transaction"
        />
      </TeamKeyTransactionManager.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    expect(getTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [allTeamsCheckbox, teamOneCheckbox, teamTwoCheckbox] =
      screen.getAllByRole('checkbox');

    expect(allTeamsCheckbox).toBeChecked();
    expect(teamOneCheckbox).toBeChecked();
    expect(teamTwoCheckbox).toBeChecked();
  });

  it('renders with some teams checked', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
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
      <TeamKeyTransactionManager.Provider
        organization={organization}
        teams={teams}
        selectedTeams={['myteams']}
      >
        <TeamKeyTransactionField
          isKeyTransaction
          organization={organization}
          projectSlug={project.slug}
          transactionName="transaction"
        />
      </TeamKeyTransactionManager.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    expect(getTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [allTeamsCheckbox, teamOneCheckbox, teamTwoCheckbox] =
      screen.getAllByRole('checkbox');

    expect(allTeamsCheckbox).not.toBeChecked();
    expect(teamOneCheckbox).toBeChecked();
    expect(teamTwoCheckbox).not.toBeChecked();
  });

  it('renders with no teams checked', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        count: 0,
        keyed: [],
      })),
    });

    render(
      <TeamKeyTransactionManager.Provider
        organization={organization}
        teams={teams}
        selectedTeams={['myteams']}
      >
        <TeamKeyTransactionField
          isKeyTransaction
          organization={organization}
          projectSlug={project.slug}
          transactionName="transaction"
        />
      </TeamKeyTransactionManager.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    expect(getTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);

    userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [allTeamsCheckbox, teamOneCheckbox, teamTwoCheckbox] =
      screen.getAllByRole('checkbox');

    expect(allTeamsCheckbox).not.toBeChecked();
    expect(teamOneCheckbox).not.toBeChecked();
    expect(teamTwoCheckbox).not.toBeChecked();
  });

  it('should be able to check one team', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
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
      <TeamKeyTransactionManager.Provider
        organization={organization}
        teams={teams}
        selectedTeams={['myteams']}
      >
        <TeamKeyTransactionField
          isKeyTransaction
          organization={organization}
          projectSlug={project.slug}
          transactionName="transaction"
        />
      </TeamKeyTransactionManager.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [_allTeamsCheckbox, teamOneCheckbox, _teamTwoCheckbox] =
      screen.getAllByRole('checkbox');

    expect(teamOneCheckbox).not.toBeChecked();

    userEvent.click(teamOneCheckbox);
    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    expect(teamOneCheckbox).toBeChecked();
  });

  it('should be able to uncheck one team', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
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
      <TeamKeyTransactionManager.Provider
        organization={organization}
        teams={teams}
        selectedTeams={['myteams']}
      >
        <TeamKeyTransactionField
          isKeyTransaction
          organization={organization}
          projectSlug={project.slug}
          transactionName="transaction"
        />
      </TeamKeyTransactionManager.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [_allTeamsCheckbox, teamOneCheckbox, _teamTwoCheckbox] =
      screen.getAllByRole('checkbox');

    expect(teamOneCheckbox).toBeChecked();

    userEvent.click(teamOneCheckbox);
    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    expect(teamOneCheckbox).not.toBeChecked();
  });

  it('should be able to check all with my teams', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
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
      <TeamKeyTransactionManager.Provider
        organization={organization}
        teams={teams}
        selectedTeams={['myteams']}
      >
        <TeamKeyTransactionField
          isKeyTransaction
          organization={organization}
          projectSlug={project.slug}
          transactionName="transaction"
        />
      </TeamKeyTransactionManager.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [allTeamsCheckbox, teamOneCheckbox, teamTwoCheckbox] =
      screen.getAllByRole('checkbox');

    expect(allTeamsCheckbox).not.toBeChecked();
    userEvent.click(allTeamsCheckbox);

    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    expect(allTeamsCheckbox).toBeChecked();
    expect(teamOneCheckbox).toBeChecked();
    expect(teamTwoCheckbox).toBeChecked();
  });

  it('should be able to uncheck all with my teams', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
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
      <TeamKeyTransactionManager.Provider
        organization={organization}
        teams={teams}
        selectedTeams={['myteams']}
      >
        <TeamKeyTransactionField
          isKeyTransaction
          organization={organization}
          projectSlug={project.slug}
          transactionName="transaction"
        />
      </TeamKeyTransactionManager.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [allTeamsCheckbox, teamOneCheckbox, teamTwoCheckbox] =
      screen.getAllByRole('checkbox');

    expect(allTeamsCheckbox).toBeChecked();
    userEvent.click(allTeamsCheckbox);

    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    expect(allTeamsCheckbox).not.toBeChecked();
    expect(teamOneCheckbox).not.toBeChecked();
    expect(teamTwoCheckbox).not.toBeChecked();
  });

  it('should render teams without access separately', async function () {
    const myTeams = [...teams, TestStubs.Team({id: '3', slug: 'team3', name: 'Team 3'})];
    act(() => {
      TeamStore.loadInitialData(myTeams);
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: myTeams.map(({id}) => ({
        team: id,
        count: 0,
        keyed: [],
      })),
    });

    render(
      <TeamKeyTransactionManager.Provider
        organization={organization}
        teams={myTeams}
        selectedTeams={['myteams']}
      >
        <TeamKeyTransactionField
          isKeyTransaction
          organization={organization}
          projectSlug={project.slug}
          transactionName="transaction"
        />
      </TeamKeyTransactionManager.Provider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    expect(screen.getByText('My Teams with Access')).toBeInTheDocument();
    expect(screen.getByText('My Teams without Access')).toBeInTheDocument();

    // Only renders checkboxes for teams with access
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByText('team3')).toBeInTheDocument();
  });
});
