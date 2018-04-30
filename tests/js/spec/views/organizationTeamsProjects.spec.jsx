import React from 'react';
import {mount} from 'enzyme';

import ProjectsStore from 'app/stores/projectsStore';

import OrganizationTeamsProjectsView from 'app/views/organizationTeamsProjects';

describe('OrganizationTeamProjects', function() {
  let project;
  let project2;
  let team;

  beforeEach(function() {
    team = TestStubs.Team({slug: 'team-slug'});
    project = TestStubs.Project({teams: [team]});
    project2 = TestStubs.Project({
      id: '3',
      slug: 'project-slug-2',
      name: 'Project Name 2',
    });

    ProjectsStore.loadInitialData([project, project2]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats/',
    });
  });

  it('Should render', function() {
    let wrapper = mount(
      <OrganizationTeamsProjectsView params={{orgId: 'org-slug'}} />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });
});
