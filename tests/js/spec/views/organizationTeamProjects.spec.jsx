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

    Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
      body: project,
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

  describe('OrganizationTeamProjects', function() {
    it('Should render', function() {
      let wrapper = mount(
        <OrganizationTeamProjects params={{orgId: 'org-slug', teamId: team.slug}} />,
        {
          context: {organization: {id: '1337', slug: 'org-slug'}},
        }
      );

      expect(wrapper).toMatchSnapshot();
      expect(wrapper.find('.project-name').text()).toBe('Project Name');
    });

    it('Should allow bookmarking', function() {
      let wrapper = mount(
        <OrganizationTeamProjects params={{orgId: 'org-slug', teamId: team.slug}} />,
        {
          context: {organization: {id: '1337', slug: 'org-slug'}},
        }
      );

      let star = wrapper.find('.icon-star-outline');
      expect(star.length).toBe(1);
      star.simulate('click');

      star = wrapper.find('.icon-star-outline');
      expect(star.length).toBe(0);
      star = wrapper.find('.icon-star-solid');
      expect(star.length).toBe(1);

      expect(
        Client.findMockResponse('/projects/org-slug/project-slug/', {
          method: 'PUT',
        })[0].callCount
      ).toBe(1);
    });

    it('Adding and removing projects works', function(done) {
      let wrapper = mount(
        <OrganizationTeamProjects params={{orgId: 'org-slug', teamId: team.slug}} />,
        {
          context: {organization: {id: '1337', slug: 'org-slug'}},
        }
      );

      let add = wrapper.find('.button-label');
      expect(add.length).toBe(1);
      expect(add.text()).toBe('Add');
      add.simulate('click');

      wrapper.update();

      expect(
        Client.findMockResponse(`/projects/org-slug/project-slug/teams/${team.slug}/`, {
          method: 'POST',
        })[0].callCount
      ).toBe(1);

      setTimeout(() => {
        wrapper.update();
        let remove = wrapper.find('.flow-layout .button-label');
        expect(remove.length).toBe(1);

        expect(remove.text()).toBe('Remove');
        remove.simulate('click');

        expect(
          Client.findMockResponse(`/projects/org-slug/project-slug/teams/${team.slug}/`, {
            method: 'DELETE',
          })[0].callCount
        ).toBe(1);

        done();
      }, 1);
    });
  });
});
