import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import ProjectTeams from 'app/views/settings/project/projectTeams';

describe('ProjectTeamsSettings', function() {
  let org;
  let project;
  let team;
  let team2 = {
    id: '2',
    slug: 'team-slug-2',
    name: 'Team Name 2',
    hasAccess: true,
  };

  beforeEach(function() {
    org = TestStubs.Organization();
    project = TestStubs.Project();
    team = TestStubs.Team();

    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    Client.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/teams/`,
      method: 'GET',
      body: [team],
    });
    Client.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [team, team2],
    });
  });

  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(
        <ProjectTeams
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
        />,
        {
          context: {
            router: TestStubs.router(),
          },
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });

  describe('TeamRow.handleRemove()', function() {
    it('can remove a team', function() {
      let endpoint = `/projects/${org.slug}/${project.slug}/teams/${team.slug}/`;
      let mock = Client.addMockResponse({
        url: endpoint,
        method: 'DELETE',
        statusCode: 200,
      });

      let wrapper = mount(
        <ProjectTeams
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
        />,
        {
          context: {
            router: TestStubs.router(),
          },
        }
      );

      expect(mock).not.toHaveBeenCalled();

      // open modal
      wrapper.find('.button-default').simulate('click');

      // click confirm
      wrapper
        .find('.modal-footer')
        .find('button.button-primary')
        .simulate('click');

      expect(mock).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('ProjectTeams.handleAdd()', function() {
    it('can add a team', function() {
      let endpoint = `/projects/${org.slug}/${project.slug}/teams/${team2.slug}/`;
      let mock = Client.addMockResponse({
        url: endpoint,
        method: 'POST',
        statusCode: 200,
      });

      let wrapper = mount(
        <ProjectTeams
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
        />,
        {
          context: {
            router: TestStubs.router(),
          },
        }
      );

      expect(mock).not.toHaveBeenCalled();

      // open dropdown
      wrapper.find('DropdownLink').simulate('click');

      // click a team
      wrapper
        .find('MenuItem')
        .find('a')
        .simulate('click');

      expect(mock).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
