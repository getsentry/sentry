import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import TeamMembers from 'app/views/settings/organizationTeams/teamMembers';

describe('TeamMembers', function() {
  const routerContext = TestStubs.routerContext();
  const org = routerContext.context.organization;
  const team = TestStubs.Team();
  const members = TestStubs.Members();

  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: members,
    });
    Client.addMockResponse({
      url: `/teams/${org.slug}/${team.slug}/members/`,
      method: 'GET',
      body: members,
    });
  });

  it('renders', function() {
    const wrapper = shallow(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('can remove a team', function() {
    const endpoint = `/organizations/${org.slug}/members/${members[0]
      .id}/teams/${team.slug}/`;
    const mock = Client.addMockResponse({
      url: endpoint,
      method: 'DELETE',
      statusCode: 200,
    });

    const wrapper = mount(
      <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
      routerContext
    );

    expect(mock).not.toHaveBeenCalled();

    wrapper
      .find('Button')
      .at(1)
      .simulate('click');

    expect(mock).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });
});
