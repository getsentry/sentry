import React from 'react';
import {mount, shallow} from 'enzyme';

import ProjectSelector from 'app/components/projectHeader/projectSelector';

describe('ProjectSelector', function() {
  const testTeam = TestStubs.Team({
    id: 'test-team',
    slug: 'test-team',
    isMember: true,
  });

  const testProject = TestStubs.Project({
    id: 'test-project',
    slug: 'test-project',
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

  beforeAll(function() {
    jest.spyOn(window.location, 'assign').mockImplementation(() => {});
  });

  afterAll(function() {
    window.location.assign.mockRestore();
  });

  const openMenu = wrapper => wrapper.find('DropdownLabel').simulate('click');

  it('should show empty message with no projects button, when no projects, and has no "project:write" access', function() {
    let wrapper = mount(
      <ProjectSelector
        organization={{
          id: 'org',
          slug: 'org-slug',
          teams: [],
          projects: [],
          access: [],
        }}
        projectId=""
      />,
      TestStubs.routerContext()
    );
    openMenu(wrapper);
    expect(wrapper.find('EmptyMessage').prop('children')).toBe('You have no projects');
    // Should not have "Create Project" button
    expect(wrapper.find('CreateProjectButton')).toHaveLength(0);
  });

  it('should show empty message and create project button, when no projects and has "project:write" access', function() {
    let wrapper = mount(
      <ProjectSelector
        organization={{
          id: 'org',
          slug: 'org-slug',
          teams: [],
          projects: [],
          access: ['project:write'],
        }}
        projectId=""
      />,
      TestStubs.routerContext()
    );
    openMenu(wrapper);
    expect(wrapper.find('EmptyMessage').prop('children')).toBe('You have no projects');
    // Should not have "Create Project" button
    expect(wrapper.find('CreateProjectButton')).toHaveLength(1);
  });

  it('lists projects and has filter', function() {
    let wrapper = mount(
      <ProjectSelector organization={mockOrg} projectId="" />,
      TestStubs.routerContext()
    );
    openMenu(wrapper);
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(2);
  });

  it('can filter projects by project name', function() {
    let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});
    openMenu(wrapper);

    wrapper.find('StyledInput').simulate('change', {target: {value: 'TEST'}});

    const result = wrapper.find('AutoCompleteItem ProjectBadge');
    expect(result).toHaveLength(1);
    expect(result.prop('project').slug).toBe('test-project');
  });

  it('does not close dropdown when input is clicked', async function() {
    let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});
    openMenu(wrapper);

    wrapper.find('StyledInput').simulate('click');
    await tick();
    wrapper.update();
    expect(wrapper.find('DropdownMenu').prop('isOpen')).toBe(true);
  });

  it('closes dropdown when project is selected', function() {
    let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});
    openMenu(wrapper);

    // Select first project
    wrapper
      .find('AutoCompleteItem')
      .first()
      .simulate('click');
    expect(wrapper.find('DropdownMenu').prop('isOpen')).toBe(false);
  });

  it('shows empty filter message when filtering has no results', function() {
    let wrapper = mount(<ProjectSelector organization={mockOrg} projectId="" />, {});
    openMenu(wrapper);

    wrapper.find('StyledInput').simulate('change', {target: {value: 'Foo'}});
    expect(wrapper.find('EmptyMessage').prop('children')).toBe('No projects found');
  });
});
