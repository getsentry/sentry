import {Component} from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import TeamKeyTransaction from 'app/components/performance/teamKeyTransaction';
import {MAX_TEAM_KEY_TRANSACTIONS} from 'app/utils/performance/constants';

class TestButton extends Component {
  render() {
    const {keyedTeamsCount, ...props} = this.props;
    return <button {...props}>{`count: ${keyedTeamsCount}`}</button>;
  }
}

async function clickTeamKeyTransactionDropdown(wrapper) {
  wrapper.find('TestButton').simulate('click');
  await tick();
  wrapper.update();
}

describe('TeamKeyTransaction', function () {
  const organization = TestStubs.Organization({features: ['performance-view']});
  const project = TestStubs.Project();
  const teams = [
    TestStubs.Team({id: '1', slug: 'team1', name: 'Team 1'}),
    TestStubs.Team({id: '2', slug: 'team2', name: 'Team 2'}),
  ];

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('With no disabled', function () {
    beforeEach(function () {
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/key-transactions-count/',
        body: teams.map(({id}) => ({team: id, count: 0})),
      });
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
          title={TestButton}
        />
      );
      await tick();
      wrapper.update();

      clickTeamKeyTransactionDropdown(wrapper);

      // header should show the checked state
      expect(getTeamKeyTransactionsMock).toHaveBeenCalledTimes(1);
      expect(wrapper.find('TestButton').exists()).toBeTruthy();
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
          title={TestButton}
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
        expect(entry.text()).toEqual(teams[i].name);
      });
      expect(entries.at(0).find('CheckboxFancy').props().isChecked).toBeTruthy();
      expect(entries.at(1).find('CheckboxFancy').props().isChecked).toBeFalsy();
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
          title={TestButton}
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
        expect(entry.text()).toEqual(teams[i].name);
        expect(entry.find('CheckboxFancy').props().isChecked).toBeFalsy();
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
          title={TestButton}
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
          title={TestButton}
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
          title={TestButton}
        />
      );
      await tick();
      wrapper.update();

      clickTeamKeyTransactionDropdown(wrapper);

      wrapper.find('DropdownMenuHeader CheckboxFancy').simulate('click');
      await tick();
      wrapper.update();

      clickTeamKeyTransactionDropdown(wrapper);

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
          title={TestButton}
        />
      );
      await tick();
      wrapper.update();

      clickTeamKeyTransactionDropdown(wrapper);

      wrapper.find('DropdownMenuHeader CheckboxFancy').simulate('click');
      await tick();
      wrapper.update();

      clickTeamKeyTransactionDropdown(wrapper);

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
  });

  describe('With disabled', function () {
    it('renders unkeyed as disabled if count exceeds max', async function () {
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/key-transactions/',
        body: [],
      });

      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/key-transactions-count/',
        body: teams.map(({id}) => ({team: id, count: MAX_TEAM_KEY_TRANSACTIONS})),
      });

      const wrapper = mountWithTheme(
        <TeamKeyTransaction
          project={project.id}
          organization={organization}
          teams={teams}
          transactionName="transaction"
          title={TestButton}
        />
      );
      await tick();
      wrapper.update();

      clickTeamKeyTransactionDropdown(wrapper);

      const entries = wrapper.find('DropdownMenuItem');
      expect(entries.length).toBe(2);
      entries.forEach((entry, i) => {
        expect(entry.props().disabled).toBeTruthy();
        expect(entry.text()).toEqual(`${teams[i].name}Max.${MAX_TEAM_KEY_TRANSACTIONS}`);
      });
    });

    it('renders keyed as checked even if count is maxed', async function () {
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/key-transactions/',
        body: teams.map(({id}) => ({team: id})),
      });

      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/key-transactions-count/',
        body: teams.map(({id}) => ({team: id, count: MAX_TEAM_KEY_TRANSACTIONS})),
      });

      const wrapper = mountWithTheme(
        <TeamKeyTransaction
          project={project.id}
          organization={organization}
          teams={teams}
          transactionName="transaction"
          title={TestButton}
        />
      );
      await tick();
      wrapper.update();

      clickTeamKeyTransactionDropdown(wrapper);

      const entries = wrapper.find('DropdownMenuItem');
      expect(entries.length).toBe(2);
      entries.forEach((entry, i) => {
        expect(entry.props().disabled).toBeFalsy();
        expect(entry.text()).toEqual(teams[i].name);
        expect(entry.find('CheckboxFancy').props().isChecked).toBeTruthy();
      });
    });
  });
});
