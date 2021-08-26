import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import EventView from 'app/utils/discover/eventView';
import {MAX_TEAM_KEY_TRANSACTIONS} from 'app/utils/performance/constants';
import TeamKeyTransactionButton from 'app/views/performance/transactionSummary/teamKeyTransactionButton';

async function clickTeamKeyTransactionDropdown(wrapper) {
  wrapper.find('Button').simulate('click');
  await tick();
  wrapper.update();
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
    ProjectsStore.loadInitialData([project]);
    TeamStore.loadInitialData(teams);
  });

  it('fetches key transactions with project param', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse(
      {
        method: 'GET',
        url: '/organizations/org-slug/key-transactions-list/',
        body: teams.map(({id}) => ({
          team: id,
          count: 1,
          keyed: [{project_id: String(project.id), transaction: 'transaction'}],
        })),
      },
      {
        predicate: (_, options) => {
          return (
            options.method === 'GET' &&
            options.query.project.length === 1 &&
            options.query.project[0] === project.id &&
            options.query.team.length === 1 &&
            options.query.team[0] === 'myteams'
          );
        },
      }
    );

    const wrapper = mountWithTheme(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );
    await tick();
    wrapper.update();

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

    const wrapper = mountWithTheme(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    // header should show the checked state
    expect(wrapper.find('TitleButton').exists()).toBeTruthy();
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.exists()).toBeTruthy();
    expect(header.find('CheckboxFancy').props().isChecked).toBeTruthy();
    expect(header.find('CheckboxFancy').props().isIndeterminate).toBeFalsy();

    // all teams should be checked
    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.text()).toEqual(teams[i].slug);
      expect(entry.find('CheckboxFancy').props().isChecked).toBeTruthy();
    });
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

    const wrapper = mountWithTheme(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );

    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    // header should show the indeterminate state
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.exists()).toBeTruthy();
    expect(header.find('CheckboxFancy').props().isChecked).toBeFalsy();
    expect(header.find('CheckboxFancy').props().isIndeterminate).toBeTruthy();

    // only team 1 should be checked
    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.text()).toEqual(teams[i].slug);
    });
    expect(entries.at(0).find('CheckboxFancy').props().isChecked).toBeTruthy();
    expect(entries.at(1).find('CheckboxFancy').props().isChecked).toBeFalsy();
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

    const wrapper = mountWithTheme(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );
    await tick();
    wrapper.update();

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
      expect(entry.text()).toEqual(teams[i].slug);
      expect(entry.find('CheckboxFancy').props().isChecked).toBeFalsy();
    });
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
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    wrapper.find('DropdownMenuItem CheckboxFancy').first().simulate('click');
    await tick();
    wrapper.update();

    const checkbox = wrapper.find('DropdownMenuItem CheckboxFancy').first();
    expect(checkbox.props().isChecked).toBeTruthy();
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
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    wrapper.find('DropdownMenuItem CheckboxFancy').first().simulate('click');
    await tick();
    wrapper.update();

    const checkbox = wrapper.find('DropdownMenuItem CheckboxFancy').first();
    expect(checkbox.props().isChecked).toBeFalsy();
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
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    wrapper.find('DropdownMenuHeader CheckboxFancy').simulate('click');
    await tick();
    wrapper.update();

    // header should be checked now
    const headerCheckbox = wrapper.find('DropdownMenuHeader CheckboxFancy');
    expect(headerCheckbox.props().isChecked).toBeTruthy();
    expect(headerCheckbox.props().isIndeterminate).toBeFalsy();

    // all teams should be checked now
    const entries = wrapper.find('DropdownMenuItem');
    entries.forEach(entry => {
      expect(entry.find('CheckboxFancy').props().isChecked).toBeTruthy();
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
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    wrapper.find('DropdownMenuHeader CheckboxFancy').simulate('click');
    await tick();
    wrapper.update();

    // header should be unchecked now
    const headerCheckbox = wrapper.find('DropdownMenuHeader CheckboxFancy');
    expect(headerCheckbox.props().isChecked).toBeFalsy();
    expect(headerCheckbox.props().isIndeterminate).toBeFalsy();

    // all teams should be unchecked now
    const entries = wrapper.find('DropdownMenuItem');
    entries.forEach(entry => {
      expect(entry.find('CheckboxFancy').props().isChecked).toBeFalsy();
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

    const wrapper = mountWithTheme(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.props().disabled).toBeTruthy();
      expect(entry.text()).toEqual(`${teams[i].slug}Max ${MAX_TEAM_KEY_TRANSACTIONS}`);
    });
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

    const wrapper = mountWithTheme(
      <TeamKeyTransactionButton
        eventView={eventView}
        organization={organization}
        transactionName="transaction"
      />
    );
    await tick();
    wrapper.update();

    clickTeamKeyTransactionDropdown(wrapper);

    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.props().disabled).toBeFalsy();
      expect(entry.text()).toEqual(teams[i].slug);
      expect(entry.find('CheckboxFancy').props().isChecked).toBeTruthy();
    });
  });
});
