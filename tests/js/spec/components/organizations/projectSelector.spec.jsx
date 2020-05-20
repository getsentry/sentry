import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectSelector from 'app/components/organizations/projectSelector';

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
    multiProjects: mockOrg.projects,
    selectedProjects: [],
  };

  it('should show empty message with no projects button, when no projects, and has no "project:write" access', function() {
    const wrapper = mountWithTheme(
      <ProjectSelector
        {...props}
        multiProjects={[]}
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

    openMenu(wrapper);
    expect(wrapper.find('EmptyMessage').prop('children')).toBe('You have no projects');
    // Should not have "Create Project" button
    expect(wrapper.find('CreateProjectButton')).toHaveLength(0);
  });

  it('should show empty message and create project button, when no projects and has "project:write" access', function() {
    const wrapper = mountWithTheme(
      <ProjectSelector
        {...props}
        multiProjects={[]}
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
    const onMultiSelectMock = jest.fn();
    const wrapper = mountWithTheme(
      <ProjectSelector
        {...props}
        multi
        onSelect={mock}
        onMultiSelect={onMultiSelectMock}
      />,
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
    expect(onMultiSelectMock).toHaveBeenCalled();
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

  it('displays projects in alphabetical order partitioned by project membership', function() {
    const projectA = TestStubs.Project({id: '1', slug: 'a-project'});
    const projectB = TestStubs.Project({id: '2', slug: 'b-project'});
    const projectANonM = TestStubs.Project({id: '3', slug: 'a-non-m-project'});
    const projectBNonM = TestStubs.Project({id: '4', slug: 'b-non-m-project'});

    const multiProjectProps = {
      ...props,
      multiProjects: [projectB, projectA],
      nonMemberProjects: [projectBNonM, projectANonM],
      selectedProjects: [],
    };

    const wrapper = mountWithTheme(
      <ProjectSelector {...multiProjectProps} />,
      routerContext
    );
    openMenu(wrapper);

    const positionA = wrapper.text().indexOf(projectA.slug);
    const positionB = wrapper.text().indexOf(projectB.slug);

    const positionANonM = wrapper.text().indexOf(projectANonM.slug);
    const positionBNonM = wrapper.text().indexOf(projectBNonM.slug);

    expect(wrapper.text()).toContain("Projects I don't belong to");
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(4);

    [positionA, positionB, positionANonM, positionBNonM].forEach(position =>
      expect(position).toBeGreaterThan(-1)
    );

    expect(positionA).toBeLessThan(positionB);
    expect(positionB).toBeLessThan(positionANonM);
    expect(positionANonM).toBeLessThan(positionBNonM);
  });

  it('displays multi projects in sort order rules: selected, bookmarked, alphabetical', function() {
    const projectA = TestStubs.Project({id: '1', slug: 'a-project'});
    const projectBBookmarked = TestStubs.Project({
      id: '2',
      slug: 'b-project',
      isBookmarked: true,
    });
    const projectCBookmarked = TestStubs.Project({
      id: '3',
      slug: 'c-project',
      isBookmarked: true,
    });
    const projectDSelected = TestStubs.Project({id: '4', slug: 'd-project'});
    const projectESelected = TestStubs.Project({id: '5', slug: 'e-project'});
    const projectFSelectedBookmarked = TestStubs.Project({
      id: '6',
      slug: 'f-project',
      isBookmarked: true,
    });
    const projectGSelectedBookmarked = TestStubs.Project({
      id: '7',
      slug: 'g-project',
      isBookmarked: true,
    });
    const projectH = TestStubs.Project({id: '8', slug: 'h-project'});
    const multiProjectProps = {
      ...props,
      multiProjects: [
        projectA,
        projectBBookmarked,
        projectCBookmarked,
        projectDSelected,
        projectESelected,
        projectFSelectedBookmarked,
        projectGSelectedBookmarked,
        projectH,
      ],
      nonMemberProjects: [],
      selectedProjects: [
        projectESelected,
        projectDSelected,
        projectGSelectedBookmarked,
        projectFSelectedBookmarked,
      ],
    };

    const wrapper = mountWithTheme(
      <ProjectSelector {...multiProjectProps} />,
      routerContext
    );
    openMenu(wrapper);

    const positionA = wrapper.text().indexOf(projectA.slug);
    const positionB = wrapper.text().indexOf(projectBBookmarked.slug);
    const positionC = wrapper.text().indexOf(projectCBookmarked.slug);
    const positionD = wrapper.text().indexOf(projectDSelected.slug);
    const positionE = wrapper.text().indexOf(projectESelected.slug);
    const positionF = wrapper.text().indexOf(projectFSelectedBookmarked.slug);
    const positionG = wrapper.text().indexOf(projectGSelectedBookmarked.slug);
    const positionH = wrapper.text().indexOf(projectH.slug);

    expect(wrapper.text()).not.toContain("Projects I don't belong to");
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(8);

    [
      positionA,
      positionB,
      positionC,
      positionD,
      positionE,
      positionF,
      positionG,
      positionH,
    ].forEach(position => expect(position).toBeGreaterThan(-1));

    expect(positionF).toBeLessThan(positionG);
    expect(positionG).toBeLessThan(positionD);
    expect(positionD).toBeLessThan(positionE);
    expect(positionE).toBeLessThan(positionB);
    expect(positionB).toBeLessThan(positionC);
    expect(positionC).toBeLessThan(positionA);
    expect(positionA).toBeLessThan(positionH);
  });

  it('displays non member projects in alphabetical sort order', function() {
    const projectA = TestStubs.Project({id: '1', slug: 'a-project'});
    const projectBBookmarked = TestStubs.Project({
      id: '2',
      slug: 'b-project',
      isBookmarked: true,
    });
    const projectCSelected = TestStubs.Project({id: '3', slug: 'c-project'});
    const projectDSelectedBookmarked = TestStubs.Project({
      id: '4',
      slug: 'd-project',
      isBookmarked: true,
    });

    const multiProjectProps = {
      ...props,
      multiProjects: [],
      nonMemberProjects: [
        projectCSelected,
        projectA,
        projectDSelectedBookmarked,
        projectBBookmarked,
      ],
      selectedProjects: [projectCSelected, projectDSelectedBookmarked],
    };

    const wrapper = mountWithTheme(
      <ProjectSelector {...multiProjectProps} />,
      routerContext
    );
    openMenu(wrapper);

    const positionA = wrapper.text().indexOf(projectA.slug);
    const positionB = wrapper.text().indexOf(projectBBookmarked.slug);
    const positionC = wrapper.text().indexOf(projectCSelected.slug);
    const positionD = wrapper.text().indexOf(projectDSelectedBookmarked.slug);

    expect(wrapper.text()).toContain("Projects I don't belong to");
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(4);

    [positionA, positionB, positionC, positionD].forEach(position =>
      expect(position).toBeGreaterThan(-1)
    );

    expect(positionA).toBeLessThan(positionB);
    expect(positionB).toBeLessThan(positionC);
    expect(positionC).toBeLessThan(positionD);
  });
});
