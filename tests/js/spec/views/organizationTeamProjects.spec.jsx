import React from 'react';
import {mount} from 'enzyme';

import {Client} from 'app/api';
import TeamStore from 'app/stores/teamStore';
import ProjectsStore from 'app/stores/projectsStore';

import OrganizationTeamProjects from 'app/views/settings/team/teamProjects';

describe('OrganizationTeamProjects', function() {
  let project;
  let project2;
  let team;
  let putMock;
  let postMock;
  let deleteMock;

  beforeEach(function() {
    team = TestStubs.Team({slug: 'team-slug'});
    project = TestStubs.Project({teams: [team]});
    project2 = TestStubs.Project({
      id: '3',
      slug: 'project-slug-2',
      name: 'Project Name 2',
    });

    TeamStore.loadInitialData([team]);
    ProjectsStore.loadInitialData([project, project2]);

    putMock = Client.addMockResponse({
      method: 'PUT',
      url: '/projects/org-slug/project-slug/',
      body: project,
    });

    postMock = Client.addMockResponse({
      method: 'POST',
      url: `/projects/org-slug/${project2.slug}/teams/${team.slug}/`,
      body: {...project2, teams: [team]},
      status: 201,
    });

    deleteMock = Client.addMockResponse({
      method: 'DELETE',
      url: `/projects/org-slug/${project2.slug}/teams/${team.slug}/`,
      body: {...project2, teams: []},
      status: 204,
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

    let add = wrapper.find('DropdownButton').first();
    add.simulate('click');

    let el = wrapper.find('AutoCompleteItem').first();
    el.simulate('click');

    wrapper.update();

    expect(postMock).toHaveBeenCalledTimes(1);

    setTimeout(() => {
      wrapper.update();
      // find first project's remove button
      let remove = wrapper.find('Button').at(1);
      remove.simulate('click');

      expect(deleteMock).toHaveBeenCalledTimes(1);

      done();
    }, 1);
  });
});
