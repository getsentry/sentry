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
    let project = TestStubs.Project();
    let project2 = TestStubs.Project({
      id: '3',
      slug: 'project-slug-2',
      name: 'Project Name 2',
    });
    team = TestStubs.Team({projects: [project]});

    TeamStore.loadInitialData([team]);
    ProjectsStore.loadInitialData([project, project2]);

    putMock = Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
      body: project,
    });

    postMock = Client.addMockResponse({
      method: 'POST',
      url: `/projects/org-slug/project-slug-2/teams/${team.slug}/`,
    });

    deleteMock = Client.addMockResponse({
      method: 'DELETE',
      url: `/projects/org-slug/project-slug-2/teams/${team.slug}/`,
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

  it('Should allow adding and removing projects', function(done) {
    let wrapper = mount(
      <OrganizationTeamProjects params={{orgId: 'org-slug', teamId: team.slug}} />,
      TestStubs.routerOrganizationContext()
    );

    let add = wrapper.find('.button-label').first();
    expect(add.text()).toBe('Add Project');
    add.simulate('click');

    // is there a better way to do this???
    let el = wrapper
      .find('.autocomplete-items')
      .childAt(0)
      .childAt(0);
    el.simulate('click');

    wrapper.update();

    expect(postMock).toHaveBeenCalledTimes(1);

    setTimeout(() => {
      wrapper.update();
      let remove = wrapper.find('.flow-layout .button-label').at(1);

      expect(remove.text()).toBe('Remove');
      remove.simulate('click');

      expect(deleteMock).toHaveBeenCalledTimes(1);

      done();
    }, 1);
  });
});
