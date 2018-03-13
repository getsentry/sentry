import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import TeamMembers from 'app/views/settings/team/teamMembers';

describe('TeamMembers', function() {
  let org;
  let team;
  let members;

  beforeEach(function() {
    org = TestStubs.Organization();
    team = TestStubs.Team();
    members = TestStubs.Members();

    Client.addMockResponse({
      url: `/teams/${org.slug}/${team.slug}/members/`,
      method: 'GET',
      body: members,
    });
  });

  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(
        <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
        {
          context: {
            organization: org,
          },
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('TeamMembers.removeMember()', function() {
    it('can remove a team', function() {
      let endpoint = `/organizations/${org.slug}/members/${members[0]
        .id}/teams/${team.slug}/`;
      let mock = Client.addMockResponse({
        url: endpoint,
        method: 'DELETE',
        statusCode: 200,
      });

      let wrapper = mount(
        <TeamMembers params={{orgId: org.slug, teamId: team.slug}} organization={org} />,
        {
          context: {
            organization: org,
          },
        }
      );

      expect(mock).not.toHaveBeenCalled();

      wrapper
        .find('.button-default')
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
});
