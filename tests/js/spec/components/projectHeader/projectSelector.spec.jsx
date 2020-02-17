import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectHeaderProjectSelector from 'app/components/projectHeader/projectSelector';
import ProjectsStore from 'app/stores/projectsStore';

describe('ProjectHeaderProjectSelector', function() {
  const testTeam = TestStubs.Team({
    id: 'test-team',
    slug: 'test-team',
    isMember: true,
  });

  const testProject = TestStubs.Project({
    id: 'test-project',
    slug: 'test-project',
    isBookmarked: true,
    isMember: true,
    teams: [testTeam],
  });
  const anotherProject = TestStubs.Project({
    id: 'another-project',
    slug: 'another-project',
    isMember: true,
    teams: [testTeam],
  });

  const mockOrg = TestStubs.Organization({
    id: 'org',
    slug: 'org',
    teams: [testTeam],
    projects: [testProject, anotherProject],
    features: ['new-teams'],
    access: [],
  });

  const routerContext = TestStubs.routerContext([{organization: mockOrg}]);

  const openMenu = wrapper => wrapper.find('DropdownLabel').simulate('click');

  beforeEach(function() {
    ProjectsStore.loadInitialData(mockOrg.projects);
  });

  it('renders with "Select a project" when no project is selected', function() {
    const wrapper = mountWithTheme(
      <ProjectHeaderProjectSelector organization={mockOrg} projectId="" />,
      routerContext
    );

    expect(wrapper.find('SelectProject')).toHaveLength(1);
  });

  it('has project label when project is selected', function() {
    const wrapper = mountWithTheme(
      <ProjectHeaderProjectSelector organization={mockOrg} projectId="" />,
      routerContext
    );
    openMenu(wrapper);

    // Select first project
    wrapper
      .find('AutoCompleteItem')
      .first()
      .simulate('click');

    expect(wrapper.find('IdBadge').prop('project')).toEqual(
      expect.objectContaining({
        slug: 'test-project',
      })
    );
  });

  it('calls `router.push` when a project is selected', function() {
    const routerMock = TestStubs.router();
    const wrapper = mountWithTheme(
      <ProjectHeaderProjectSelector
        organization={mockOrg}
        projectId=""
        router={routerMock}
      />,
      routerContext
    );
    openMenu(wrapper);

    // Select first project
    wrapper
      .find('AutoCompleteItem')
      .first()
      .simulate('click');

    expect(routerMock.push).toHaveBeenCalledWith('/org/test-project/');
  });
});
