import React from 'react';

import {mount} from 'enzyme';
import {selectByValue} from 'app-test/helpers/select';
import ConfigStore from 'app/stores/configStore';
import InviteMembers from 'app/views/onboarding/projectSetup/inviteMembers';

describe('InviteMembers', function() {
  const email = 'test@someDomain.com';
  ConfigStore.loadInitialData({user: {email, options: {}}});

  const org = TestStubs.Organization();
  const project = TestStubs.ProjectDetails({
    team: {slug: 'team1'},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${org.slug}/members/me/`,
    method: 'GET',
    body: {roles: [{id: 'admin', name: 'Admin', desc: 'User Admin'}]},
  });

  it('displays an example email using their domain', function() {
    const wrapper = mount(
      <InviteMembers project={project} organization={org} />,
      TestStubs.routerContext()
    );

    expect(wrapper.find('EmailField').props().placeholder).toEqual(
      expect.stringContaining('team.member@someDomain.com')
    );
  });

  it('adds a new team member', async function() {
    const addMemberApi = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
      body: {email: 'rick@morty.com'},
    });

    const wrapper = mount(
      <InviteMembers project={project} organization={org} />,
      TestStubs.routerContext()
    );

    await tick();

    wrapper
      .find('input[id="email"]')
      .simulate('change', {target: {value: 'rick@morty.com'}});
    selectByValue(wrapper, 'admin', {name: 'role'});

    wrapper.find('form').simulate('submit');

    expect(addMemberApi).toHaveBeenCalled();

    await tick();
    wrapper.update();

    expect(wrapper.find('Alert').exists()).toBe(true);
    expect(wrapper.find('Alert').text()).toEqual(
      'rick@morty.com has been invited to your organization.'
    );
  });
});
