import {mountWithTheme} from 'sentry-test/enzyme';

import * as TeamKeyTransactionManager from 'app/components/performance/teamKeyTransactionsManager';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import TeamKeyTransactionField from 'app/utils/discover/teamKeyTransactionField';

async function clickTeamKeyTransactionDropdown(wrapper) {
  wrapper.find('IconStar').simulate('click');
  await tick();
  wrapper.update();
}

describe('TeamKeyTransactionField', function () {
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();
  const teams = [
    TestStubs.Team({id: '1', slug: 'team1', name: 'Team 1'}),
    TestStubs.Team({id: '2', slug: 'team2', name: 'Team 2'}),
  ];

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    TeamStore.loadInitialData(teams);
  });

  it('renders with all teams checked', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        keyed: [{project_id: String(project.id), transaction: 'transaction'}],
      })),
    });

    const wrapper = mountWithTheme(
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
    await tick();
    wrapper.update();

    expect(getTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('IconStar').exists()).toBeTruthy();
    expect(wrapper.find('IconStar').props().isSolid).toBeTruthy();

    clickTeamKeyTransactionDropdown(wrapper);

    // header should show the checked state
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.exists()).toBeTruthy();
    expect(header.find('CheckboxFancy').props().isChecked).toBeTruthy();
    expect(header.find('CheckboxFancy').props().isIndeterminate).toBeFalsy();

    // all teams should be checked
    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.text()).toEqual(teams[i].name);
      expect(entry.find('CheckboxFancy').props().isChecked).toBeTruthy();
    });
  });

  it('renders with some teams checked', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        keyed:
          id === teams[0].id
            ? [{project_id: String(project.id), transaction: 'transaction'}]
            : [],
      })),
    });

    const wrapper = mountWithTheme(
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
    await tick();
    wrapper.update();

    expect(getTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('IconStar').exists()).toBeTruthy();
    expect(wrapper.find('IconStar').props().isSolid).toBeTruthy();

    clickTeamKeyTransactionDropdown(wrapper);

    // header should show the indeterminate state
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.exists()).toBeTruthy();
    expect(header.find('CheckboxFancy').props().isChecked).toBeFalsy();
    expect(header.find('CheckboxFancy').props().isIndeterminate).toBeTruthy();

    // all teams should be checked
    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.text()).toEqual(teams[i].name);
    });
    expect(entries.at(0).find('CheckboxFancy').props().isChecked).toBeTruthy();
    expect(entries.at(1).find('CheckboxFancy').props().isChecked).toBeFalsy();
  });

  it('renders with no teams checked', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        keyed: [],
      })),
    });

    const wrapper = mountWithTheme(
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
    await tick();
    wrapper.update();

    expect(getTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('IconStar').exists()).toBeTruthy();
    expect(wrapper.find('IconStar').props().isSolid).toBeFalsy();

    clickTeamKeyTransactionDropdown(wrapper);

    // header should show the unchecked state
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.exists()).toBeTruthy();
    expect(header.find('CheckboxFancy').props().isChecked).toBeFalsy();
    expect(header.find('CheckboxFancy').props().isIndeterminate).toBeFalsy();

    // all teams should be unchecked
    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.text()).toEqual(teams[i].name);
      expect(entry.find('CheckboxFancy').props().isChecked).toBeFalsy();
    });
  });

  it('should be able to check one team', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        keyed: [],
      })),
    });

    const postTeamKeyTransactionsMock = MockApiClient.addMockResponse(
      {
        method: 'POST',
        url: '/organizations/org-slug/key-transactions/',
        body: [],
      },
      {
        predicate: (_, options) =>
          options.method === 'POST' &&
          options.query.project.length === 1 &&
          options.query.project[0] === project.id &&
          options.data.team.length === 1 &&
          options.data.team[0] === teams[0].id &&
          options.data.transaction === 'transaction',
      }
    );

    const wrapper = mountWithTheme(
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
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    expect(
      wrapper.find('DropdownMenuItem CheckboxFancy').first().props().isChecked
    ).toBeFalsy();

    wrapper.find('DropdownMenuItem CheckboxFancy').first().simulate('click');
    await tick();
    wrapper.update();

    expect(
      wrapper.find('DropdownMenuItem CheckboxFancy').first().props().isChecked
    ).toBeTruthy();
    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('should be able to uncheck one team', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        keyed: [{project_id: String(project.id), transaction: 'transaction'}],
      })),
    });

    const deleteTeamKeyTransactionsMock = MockApiClient.addMockResponse(
      {
        method: 'DELETE',
        url: '/organizations/org-slug/key-transactions/',
        body: [],
      },
      {
        predicate: (_, options) =>
          options.method === 'DELETE' &&
          options.query.project.length === 1 &&
          options.query.project[0] === project.id &&
          options.data.team.length === 1 &&
          options.data.team[0] === teams[0].id &&
          options.data.transaction === 'transaction',
      }
    );

    const wrapper = mountWithTheme(
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
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    expect(
      wrapper.find('DropdownMenuItem CheckboxFancy').first().props().isChecked
    ).toBeTruthy();

    wrapper.find('DropdownMenuItem CheckboxFancy').first().simulate('click');
    await tick();
    wrapper.update();

    expect(
      wrapper.find('DropdownMenuItem CheckboxFancy').first().props().isChecked
    ).toBeFalsy();
    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('should be able to check all with my teams', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        keyed: [],
      })),
    });

    const postTeamKeyTransactionsMock = MockApiClient.addMockResponse(
      {
        method: 'POST',
        url: '/organizations/org-slug/key-transactions/',
        body: [],
      },
      {
        predicate: (_, options) =>
          options.method === 'POST' &&
          options.query.project.length === 1 &&
          options.query.project[0] === project.id &&
          options.data.team.length === 2 &&
          options.data.team[0] === teams[0].id &&
          options.data.team[1] === teams[1].id &&
          options.data.transaction === 'transaction',
      }
    );

    const wrapper = mountWithTheme(
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
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    wrapper.find('DropdownMenuHeader CheckboxFancy').simulate('click');
    await tick();
    wrapper.update();

    const headerCheckbox = wrapper.find('DropdownMenuHeader CheckboxFancy');
    expect(headerCheckbox.props().isChecked).toBeTruthy();
    expect(headerCheckbox.props().isIndeterminate).toBeFalsy();

    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('should be able to uncheck all with my teams', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        keyed: [{project_id: String(project.id), transaction: 'transaction'}],
      })),
    });

    const deleteTeamKeyTransactionsMock = MockApiClient.addMockResponse(
      {
        method: 'DELETE',
        url: '/organizations/org-slug/key-transactions/',
        body: [],
      },
      {
        predicate: (_, options) =>
          options.method === 'DELETE' &&
          options.query.project.length === 1 &&
          options.query.project[0] === project.id &&
          options.data.team.length === 2 &&
          options.data.team[0] === teams[0].id &&
          options.data.team[1] === teams[1].id &&
          options.data.transaction === 'transaction',
      }
    );

    const wrapper = mountWithTheme(
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
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    wrapper.find('DropdownMenuHeader CheckboxFancy').simulate('click');
    await tick();
    wrapper.update();

    const headerCheckbox = wrapper.find('DropdownMenuHeader CheckboxFancy');
    expect(headerCheckbox.props().isChecked).toBeFalsy();
    expect(headerCheckbox.props().isIndeterminate).toBeFalsy();

    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });
});
