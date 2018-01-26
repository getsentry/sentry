import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import ProjectTeams from 'app/views/settings/project/projectTeams';

describe('ProjectTeamsSettings', function() {
  let org;
  let project;
  let team;

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

  describe('handleRemove()', function() {
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
      wrapper.find('Button').simulate('click');

      // click confrim
      wrapper.find('button.button-primary').simulate('click');

      expect(mock).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});
