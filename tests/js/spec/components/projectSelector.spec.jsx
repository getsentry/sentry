import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectSelector from 'app/components/projectSelector';
import ProjectsStore from 'app/stores/projectsStore';

describe('ProjectSelector', function() {
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

  const openMenu = wrapper =>
    wrapper.find('[data-test-id="test-actor"]').simulate('click');

  const actorRenderer = jest.fn(() => <div data-test-id="test-actor" />);

  const props = {
    organization: mockOrg,
    projectId: '',
    children: actorRenderer,
  };

  beforeEach(function() {
    ProjectsStore.loadInitialData(mockOrg.projects);
  });

  it('should show empty message with no projects button, when no projects, and has no "project:write" access', function() {
    const wrapper = mountWithTheme(
      <ProjectSelector
        {...props}
        organization={{
          id: 'org',
          slug: 'org-slug',
          teams: [],
          projects: [],
          access: [],
        }}
      />,
      routerContext
    );

    ProjectsStore.loadInitialData([]);

    openMenu(wrapper);
    expect(wrapper.find('EmptyMessage').prop('children')).toBe('You have no projects');
    // Should not have "Create Project" button
    expect(wrapper.find('CreateProjectButton')).toHaveLength(0);
  });

  it('should show empty message and create project button, when no projects and has "project:write" access', function() {
    const wrapper = mountWithTheme(
      <ProjectSelector
        {...props}
        organization={{
          id: 'org',
          slug: 'org-slug',
          teams: [],
          projects: [],
          access: ['project:write'],
        }}
      />,
      routerContext
    );

    ProjectsStore.loadInitialData([]);

    openMenu(wrapper);
    expect(wrapper.find('EmptyMessage').prop('children')).toBe('You have no projects');
    // Should not have "Create Project" button
    expect(wrapper.find('CreateProjectButton')).toHaveLength(1);
  });

  it('lists projects and has filter', function() {
    const wrapper = mountWithTheme(<ProjectSelector {...props} />, routerContext);
    openMenu(wrapper);
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(2);
  });

  it('can filter projects by project name', function() {
    const wrapper = mountWithTheme(<ProjectSelector {...props} />, routerContext);
    openMenu(wrapper);

    wrapper.find('StyledInput').simulate('change', {target: {value: 'TEST'}});

    const result = wrapper.find('AutoCompleteItem ProjectBadge');
    expect(result).toHaveLength(1);
    expect(result.prop('project').slug).toBe('test-project');
  });

  it('does not close dropdown when input is clicked', async function() {
    const wrapper = mountWithTheme(<ProjectSelector {...props} />, routerContext);
    openMenu(wrapper);

    wrapper.find('StyledInput').simulate('click');
    await tick();
    wrapper.update();
    expect(wrapper.find('DropdownMenu').prop('isOpen')).toBe(true);
  });

  it('closes dropdown when project is selected', function() {
    const wrapper = mountWithTheme(<ProjectSelector {...props} />, routerContext);
    openMenu(wrapper);

    // Select first project
    wrapper
      .find('AutoCompleteItem')
      .first()
      .simulate('click');
    expect(wrapper.find('DropdownMenu').prop('isOpen')).toBe(false);
  });

  it('calls callback when project is selected', function() {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ProjectSelector {...props} onSelect={mock} />,
      routerContext
    );
    openMenu(wrapper);

    // Select first project
    wrapper
      .find('AutoCompleteItem')
      .first()
      .simulate('click');

    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'test-project',
      })
    );
  });

  it('shows empty filter message when filtering has no results', function() {
    const wrapper = mountWithTheme(<ProjectSelector {...props} />, routerContext);
    openMenu(wrapper);

    wrapper.find('StyledInput').simulate('change', {target: {value: 'Foo'}});
    expect(wrapper.find('EmptyMessage').prop('children')).toBe('No projects found');
  });

  it('does not call `onSelect` when using multi select', function() {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ProjectSelector {...props} multi onSelect={mock} />,
      routerContext
    );
    openMenu(wrapper);

    // Select first project
    wrapper
      .find('CheckboxHitbox')
      .first()
      .simulate('click');

    // onSelect callback should NOT be called
    expect(mock).not.toHaveBeenCalled();
  });

  it('calls `onMultiSelect` and render prop when using multi select as an uncontrolled component', async function() {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ProjectSelector {...props} multi onMultiSelect={mock} />,
      routerContext
    );
    openMenu(wrapper);

    // Select first project
    wrapper
      .find('CheckboxHitbox')
      .at(0)
      .simulate('click', {target: {checked: true}});

    expect(mock).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          slug: 'test-project',
        }),
      ],
      expect.anything()
    );

    expect(actorRenderer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedProjects: [expect.objectContaining({slug: 'test-project'})],
      })
    );

    expect(
      Array.from(
        wrapper
          .find('ProjectSelectorItem')
          .filterWhere(p => p.prop('isChecked'))
          .map(p => p.prop('project').slug)
      )
    ).toEqual(['test-project']);

    // second project
    wrapper
      .find('CheckboxHitbox')
      .at(1)
      .simulate('click', {target: {checked: true}});

    expect(mock).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          slug: 'test-project',
        }),
        expect.objectContaining({
          slug: 'another-project',
        }),
      ],
      expect.anything()
    );
    expect(actorRenderer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedProjects: [
          expect.objectContaining({slug: 'test-project'}),
          expect.objectContaining({slug: 'another-project'}),
        ],
      })
    );
    expect(
      Array.from(
        wrapper
          .find('ProjectSelectorItem')
          .filterWhere(p => p.prop('isChecked'))
          .map(p => p.prop('project').slug)
      )
    ).toEqual(['test-project', 'another-project']);

    // Can unselect item
    wrapper
      .find('CheckboxHitbox')
      .at(1)
      .simulate('click', {target: {checked: false}});

    expect(mock).toHaveBeenLastCalledWith(
      [
        expect.objectContaining({
          slug: 'test-project',
        }),
      ],
      expect.anything()
    );
    expect(actorRenderer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        selectedProjects: [expect.objectContaining({slug: 'test-project'})],
      })
    );
    expect(
      Array.from(
        wrapper
          .find('ProjectSelectorItem')
          .filterWhere(p => p.prop('isChecked'))
          .map(p => p.prop('project').slug)
      )
    ).toEqual(['test-project']);
  });

  it('displays multi projects', function() {
    const project = TestStubs.Project();
    const multiProjectProps = {...props, multiProjects: [project]};

    const wrapper = mountWithTheme(
      <ProjectSelector {...multiProjectProps} />,
      routerContext
    );
    openMenu(wrapper);
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(1);
    expect(wrapper.text()).not.toContain("Projects I don't belong to");
  });

  it('displays multi projects with non member projects', function() {
    const project = TestStubs.Project({id: '1'});
    const nonMemberProject = TestStubs.Project({id: '2'});
    const multiProjectProps = {
      ...props,
      multiProjects: [project],
      nonMemberProjects: [nonMemberProject],
    };

    const wrapper = mountWithTheme(
      <ProjectSelector {...multiProjectProps} />,
      routerContext
    );
    openMenu(wrapper);
    expect(wrapper.text()).toContain("Projects I don't belong to");
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(2);
  });
});
