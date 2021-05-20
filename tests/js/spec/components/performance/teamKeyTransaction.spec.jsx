import {mountWithTheme} from 'sentry-test/enzyme';

import TeamKeyTransaction from 'app/components/performance/teamKeyTransaction';

function TestTitle({disabled, keyedTeamsCount}) {
  return <p>{disabled ? 'disabled' : `count: ${keyedTeamsCount}`}</p>;
}

describe('TeamKeyTransaction', function () {
  const organization = TestStubs.Organization({features: ['performance-view']});
  const project = TestStubs.Project();
  const teams = [
    TestStubs.Team({id: '1', slug: 'team1', name: 'Team 1'}),
    TestStubs.Team({id: '2', slug: 'team2', name: 'Team 2'}),
  ];

  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders with all teams checked', async function () {
    const getTeamKeyTransactionsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions/',
      body: teams.map(({id}) => ({team: id})),
    });

    const wrapper = mountWithTheme(
      <TeamKeyTransaction
        project={project.id}
        organization={organization}
        teams={teams}
        transactionName="transaction"
        title={TestTitle}
      />
    );

    await tick();
    wrapper.update();

    // header should show the checked state
    expect(getTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
    expect(wrapper.find('TestTitle').exists()).toBeTruthy();
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.exists()).toBeTruthy();
    expect(header.find('StyledCheckbox').props().isChecked).toBeTruthy();
    expect(header.find('StyledCheckbox').props().isIndeterminate).toBeFalsy();

    // all teams should be checked
    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.text()).toEqual(teams[i].name);
      expect(entry.find('StyledCheckbox').props().isChecked).toBeTruthy();
    });
  });

  it('renders with some teams checked', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions/',
      body: [{team: teams[0].id}],
    });

    const wrapper = mountWithTheme(
      <TeamKeyTransaction
        project={project.id}
        organization={organization}
        teams={teams}
        transactionName="transaction"
        title={TestTitle}
      />
    );

    await tick();
    wrapper.update();

    // header should show the indeterminate state
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.exists()).toBeTruthy();
    expect(header.find('StyledCheckbox').props().isChecked).toBeFalsy();
    expect(header.find('StyledCheckbox').props().isIndeterminate).toBeTruthy();

    // only team 1 should be checked
    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.text()).toEqual(teams[i].name);
    });
    expect(entries.at(0).find('StyledCheckbox').props().isChecked).toBeTruthy();
    expect(entries.at(1).find('StyledCheckbox').props().isChecked).toBeFalsy();
  });

  it('renders with no teams checked', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions/',
      body: [],
    });

    const wrapper = mountWithTheme(
      <TeamKeyTransaction
        project={project.id}
        organization={organization}
        teams={teams}
        transactionName="transaction"
        title={TestTitle}
      />
    );

    await tick();
    wrapper.update();

    // header should show the unchecked state
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.exists()).toBeTruthy();
    expect(header.find('StyledCheckbox').props().isChecked).toBeFalsy();
    expect(header.find('StyledCheckbox').props().isIndeterminate).toBeFalsy();

    // all teams should be unchecked
    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.length).toBe(2);
    entries.forEach((entry, i) => {
      expect(entry.text()).toEqual(teams[i].name);
      expect(entry.find('StyledCheckbox').props().isChecked).toBeFalsy();
    });
  });

  it('should be able to check one team', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions/',
      body: [],
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
      <TeamKeyTransaction
        project={project.id}
        organization={organization}
        teams={teams}
        transactionName="transaction"
        title={TestTitle}
      />
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownMenuItem').first().simulate('click');

    await tick();
    wrapper.update();

    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.at(0).find('StyledCheckbox').props().isChecked).toBeTruthy();
    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('should be able to uncheck one team', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions/',
      body: teams.map(({id}) => ({team: id})),
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
      <TeamKeyTransaction
        project={project.id}
        organization={organization}
        teams={teams}
        transactionName="transaction"
        title={TestTitle}
      />
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownMenuItem').first().simulate('click');

    await tick();
    wrapper.update();

    const entries = wrapper.find('DropdownMenuItem');
    expect(entries.at(0).find('StyledCheckbox').props().isChecked).toBeFalsy();
    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('should be able to check all with my teams', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions/',
      body: [],
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
      <TeamKeyTransaction
        project={project.id}
        organization={organization}
        teams={teams}
        transactionName="transaction"
        title={TestTitle}
      />
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownMenuHeader').simulate('click');

    await tick();
    wrapper.update();

    // header should be checked now
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.find('StyledCheckbox').props().isChecked).toBeTruthy();
    expect(header.find('StyledCheckbox').props().isIndeterminate).toBeFalsy();

    // all teams should be checked now
    const entries = wrapper.find('DropdownMenuItem');
    entries.forEach(entry => {
      expect(entry.find('StyledCheckbox').props().isChecked).toBeTruthy();
    });
    expect(postTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });

  it('should be able to uncheck all with my teams', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/key-transactions/',
      body: teams.map(({id}) => ({team: id})),
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
      <TeamKeyTransaction
        project={project.id}
        organization={organization}
        teams={teams}
        transactionName="transaction"
        title={TestTitle}
      />
    );

    await tick();
    wrapper.update();

    wrapper.find('DropdownMenuHeader').simulate('click');

    await tick();
    wrapper.update();

    // header should be unchecked now
    const header = wrapper.find('DropdownMenuHeader');
    expect(header.find('StyledCheckbox').props().isChecked).toBeFalsy();
    expect(header.find('StyledCheckbox').props().isIndeterminate).toBeFalsy();

    // all teams should be unchecked now
    const entries = wrapper.find('DropdownMenuItem');
    entries.forEach(entry => {
      expect(entry.find('StyledCheckbox').props().isChecked).toBeFalsy();
    });

    expect(deleteTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
  });
});
