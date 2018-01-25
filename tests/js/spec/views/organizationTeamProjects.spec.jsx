import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import TeamStore from 'app/stores/teamStore';
import ProjectsStore from 'app/stores/projectsStore';

import OrganizationTeamProjects from 'app/views/settings/team/teamProjects';

describe('OrganizationTeamProjects', function() {
  let sandbox;
  // let stubbedApiRequest;
  let team;
  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    team = TestStubs.Team();
    TeamStore.loadInitialData([team]);

    let project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);
    // org = TestStubs.Organization();

    Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
    });

    Client.addMockResponse({
      method: 'POST',
      url: `/projects/org-slug/project-slug/teams/${team.slug}/`,
    });
    Client.addMockResponse({
      method: 'DELETE',
      url: `/projects/org-slug/project-slug/teams/${team.slug}/`,
    });
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('fetchStats()', function() {
    it('should make a request to the organizations endpoint', function() {
      let wrapper = mount(
        <OrganizationTeamProjects params={{orgId: 'org-slug', teamId: team.slug}} />,
        {
          context: {organization: {id: '1337', slug: 'org-slug'}},
        }
      );

      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('.project-name').text()).toBe('Project Name');

      let star = wrapper.find('.icon-star-outline');
      expect(star.length).toBe(1);
      star.simulate('click');
      star = wrapper.find('.icon-star-outline');
      expect(star.length).toBe(0);
      star = wrapper.find('.icon-star-solid');
      expect(star.length).toBe(1);

      let add = wrapper.find('.button-label');
      expect(add.length).toBe(1);
      expect(add.text()).toBe('Add');
      add.simulate('click');

      wrapper.update();
      console.log(wrapper.state());

      expect(
        Client.findMockResponse(`/projects/org-slug/project-slug/teams/${team.slug}/`, {
          method: 'POST',
        })[0].callCount
      ).toBe(1);

      let remove = wrapper.find('.button-label');
      expect(remove.length).toBe(1);
      expect(remove.text()).toBe('Remove');

      // remove.simulate('click');

      // remove = wrapper.find('.icon-remove-outline');
      // expect(remove.length).toBe(0);

      // remove = wrapper.find('.icon-remove-solid');
      // expect(remove.length).toBe(1);

      // ).toBe('Project Name');

      // NOTE: creation of OrganizationTeams causes a bunch of API requests to fire ...
      //       reset th e request stub so that we can get an accurate count
      // stubbedApiRequest.reset();

      // organizationTeams.fetchStats();

      // expect(stubbedApiRequest.callCount).toEqual(1);
      // expect(stubbedApiRequest.getCall(0).args[0]).toEqual('/organizations/123/stats/');
    });
  });
});
