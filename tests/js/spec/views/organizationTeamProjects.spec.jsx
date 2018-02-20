import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import TeamStore from 'app/stores/teamStore';
import ProjectsStore from 'app/stores/projectsStore';

import OrganizationTeamProjects from 'app/views/settings/team/teamProjects';

describe('OrganizationTeamProjects', function() {
  let team;
  let putMock;
  let postMock;
  let deleteMock;
  beforeEach(function() {
    team = TestStubs.Team();
    TeamStore.loadInitialData([team]);

    let project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);

    putMock = Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
      body: project,
    });

    postMock = Client.addMockResponse({
      method: 'POST',
      url: `/projects/org-slug/project-slug/teams/${team.slug}/`,
    });

    deleteMock = Client.addMockResponse({
      method: 'DELETE',
      url: `/projects/org-slug/project-slug/teams/${team.slug}/`,
    });
  });

  afterEach(function() {
    Client.clearMockResponses();
  });

  it('Should render', function() {
    let wrapper = mount(
      <OrganizationTeamProjects params={{orgId: 'org-slug', teamId: team.slug}} />,
      TestStubs.routerOrganizationContext()
    );

    expect(wrapper).toMatchSnapshot();
    expect(wrapper.find('.project-name').text()).toBe('Project Name');
  });

  it('Should allow bookmarking', function() {
    let wrapper = mount(
      <OrganizationTeamProjects params={{orgId: 'org-slug', teamId: team.slug}} />,
      TestStubs.routerOrganizationContext()
    );

    let star = wrapper.find('.icon-star-outline');
    expect(star.length).toBe(1);
    star.simulate('click');

    star = wrapper.find('.icon-star-outline');
    expect(star.length).toBe(0);
    star = wrapper.find('.icon-star-solid');
    expect(star.length).toBe(1);

    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it('Adding and removing projects works', function(done) {
    let wrapper = mount(
      <OrganizationTeamProjects params={{orgId: 'org-slug', teamId: team.slug}} />,
      TestStubs.routerOrganizationContext()
    );

    let add = wrapper.find('div.button-label');
    expect(add.length).toBe(1);
    expect(add.text()).toContain('Add');
    add.simulate('click');

    wrapper.update();

    expect(postMock).toHaveBeenCalledTimes(1);

    setTimeout(() => {
      wrapper.update();
      let remove = wrapper.find('div.button-label');
      expect(remove.length).toBe(1);

      expect(remove.text()).toContain('Remove');
      remove.simulate('click');

      expect(deleteMock).toHaveBeenCalledTimes(1);

      done();
    }, 1);
  });
});
