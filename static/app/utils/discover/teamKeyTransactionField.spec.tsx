import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as TeamKeyTransactionManager from 'sentry/components/performance/teamKeyTransactionsManager';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import TeamKeyTransactionField from 'sentry/utils/discover/teamKeyTransactionField';

describe('TeamKeyTransactionField', function () {
  const organization = OrganizationFixture();
  const teams = [
    TeamFixture({id: '1', slug: 'team1', name: 'Team 1'}),
    TeamFixture({id: '2', slug: 'team2', name: 'Team 2'}),
  ];
  const project = ProjectFixture({teams});

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

    await userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [teamOneOption, teamTwoOption] = screen.getAllByRole('option');
    expect(teamOneOption).toHaveAttribute('aria-selected', 'true');
    expect(teamTwoOption).toHaveAttribute('aria-selected', 'true');
  });

  it('renders with some teams checked', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        count: id === teams[0]!.id ? 1 : 0,
        keyed:
          id === teams[0]!.id
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

    await userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [teamOneOption, teamTwoOption] = screen.getAllByRole('option');
    expect(teamOneOption).toHaveAttribute('aria-selected', 'true');
    expect(teamTwoOption).toHaveAttribute('aria-selected', 'false');
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

    await userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const [teamOneOption, teamTwoOption] = screen.getAllByRole('option');
    expect(teamOneOption).toHaveAttribute('aria-selected', 'false');
    expect(teamTwoOption).toHaveAttribute('aria-selected', 'false');
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
        MockApiClient.matchData({team: [teams[0]!.id], transaction: 'transaction'}),
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

    await userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const teamOneOption = screen.getAllByRole('option')[0]!;
    expect(teamOneOption).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(teamOneOption);
    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    expect(teamOneOption).toHaveAttribute('aria-selected', 'true');
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
        MockApiClient.matchData({team: [teams[0]!.id], transaction: 'transaction'}),
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

    await userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    const teamOneOption = screen.getAllByRole('option')[0]!;
    expect(teamOneOption).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(teamOneOption);
    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    expect(teamOneOption).toHaveAttribute('aria-selected', 'false');
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
          team: [teams[0]!.id, teams[1]!.id],
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

    await userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    await userEvent.click(screen.getByRole('button', {name: 'Select All in My Teams'}));

    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    const [teamOneOption, teamTwoOption] = screen.getAllByRole('option');
    expect(teamOneOption).toHaveAttribute('aria-selected', 'true');
    expect(teamTwoOption).toHaveAttribute('aria-selected', 'true');
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
          team: [teams[0]!.id, teams[1]!.id],
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

    await userEvent.click(screen.getByRole('button', {name: 'Toggle star for team'}));

    await userEvent.click(screen.getByRole('button', {name: 'Unselect All in My Teams'}));

    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Toggle star for team'})).toBeEnabled();
    });

    const [teamOneOption, teamTwoOption] = screen.getAllByRole('option');
    expect(teamOneOption).toHaveAttribute('aria-selected', 'false');
    expect(teamTwoOption).toHaveAttribute('aria-selected', 'false');
  });
});
