import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import ProjectSelector from 'sentry/components/organizations/projectSelector';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';

describe('ProjectSelector', function () {
  const testProject = TestStubs.Project({
    id: '1',
    slug: 'test-project',
    isBookmarked: true,
    isMember: true,
  });
  const anotherProject = TestStubs.Project({
    id: '2',
    slug: 'another-project',
    isMember: true,
  });

  const mockOrg = TestStubs.Organization({
    id: '1',
    slug: 'org',
    features: ['new-teams', 'global-views'],
    access: [],
  });

  const routerContext = TestStubs.routerContext([{organization: mockOrg}]);

  function openMenu() {
    userEvent.click(screen.getByRole('button'));
  }

  function applyMenu() {
    userEvent.click(screen.getByRole('button', {name: 'Apply Filter'}));
  }

  const props = {
    customDropdownButton: () => 'Project Picker',
    customLoadingIndicator: () => 'Loading...',
    isGlobalSelectionReady: true,
    organization: mockOrg,
    memberProjects: [testProject, anotherProject],
    nonMemberProjects: [],
    value: [],
    onApplyChange: () => {},
    onChange: () => {},
    menuFooter: () => {},
  };

  it('should show empty message with no projects button, when no projects, and has no "project:write" access', function () {
    render(
      <ProjectSelector
        {...props}
        memberProjects={[]}
        organization={{
          id: 'org',
          slug: 'org-slug',
          access: [],
          features: [],
        }}
      />,
      {context: routerContext}
    );

    openMenu();
    expect(screen.getByText('You have no projects')).toBeInTheDocument();

    // Should not have "Create Project" button
    const createProject = screen.getByLabelText('Add Project');
    expect(createProject).toBeInTheDocument();
    expect(createProject).toBeDisabled();
  });

  it('should show empty message and create project button, when no projects and has "project:write" access', function () {
    render(
      <ProjectSelector
        {...props}
        memberProjects={[]}
        organization={{
          id: 'org',
          slug: 'org-slug',
          access: ['project:write'],
          features: [],
        }}
      />,
      {context: routerContext}
    );

    openMenu();
    expect(screen.getByText('You have no projects')).toBeInTheDocument();

    // Should not have "Create Project" button
    const createProject = screen.getByLabelText('Add Project');
    expect(createProject).toBeInTheDocument();
    expect(createProject).toBeEnabled();
  });

  it('does not open selector menu when disabled', function () {
    render(<ProjectSelector {...props} disabled />, {context: routerContext});
    openMenu();

    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('lists projects and has filter', function () {
    render(<ProjectSelector {...props} />, {context: routerContext});
    openMenu();

    expect(screen.getByText(testProject.slug)).toBeInTheDocument();
    expect(screen.getByText(anotherProject.slug)).toBeInTheDocument();
  });

  it('can filter projects by project name', function () {
    render(<ProjectSelector {...props} />, {context: routerContext});
    openMenu();

    screen.getByRole('textbox').focus();
    userEvent.keyboard('TEST');

    const item = screen.getByTestId('badge-display-name');
    expect(item).toBeInTheDocument();
    expect(item).toHaveTextContent(testProject.slug);
  });

  it('shows empty filter message when filtering has no results', function () {
    render(<ProjectSelector {...props} />, {context: routerContext});
    openMenu();

    screen.getByRole('textbox').focus();
    userEvent.keyboard('Foo');

    expect(screen.queryByTestId('badge-display-name')).not.toBeInTheDocument();
    expect(screen.getByText('No projects found')).toBeInTheDocument();
  });

  it('does not close dropdown when input is clicked', function () {
    render(<ProjectSelector {...props} />, {context: routerContext});
    openMenu();

    userEvent.click(screen.getByRole('textbox'));

    // Dropdown is still open
    expect(screen.getByText(testProject.slug)).toBeInTheDocument();
  });

  it('closes dropdown when project is selected', function () {
    render(<ProjectSelector {...props} />, {context: routerContext});
    openMenu();

    userEvent.click(screen.getByText(testProject.slug));

    // Dropdown is closed
    expect(screen.queryByText(testProject.slug)).not.toBeInTheDocument();
  });

  it('calls callback when project is selected', function () {
    const onApplyChangeMock = jest.fn();
    render(<ProjectSelector {...props} onApplyChange={onApplyChangeMock} />, {
      context: routerContext,
    });
    openMenu();

    // Select first project
    userEvent.click(screen.getByText(testProject.slug));

    expect(onApplyChangeMock).toHaveBeenCalledWith([parseInt(testProject.id, 10)]);
  });

  it('does not call `onUpdate` when using multi select', function () {
    const onChangeMock = jest.fn();
    const onApplyChangeMock = jest.fn();
    render(
      <ProjectSelector
        {...props}
        onChange={onChangeMock}
        onApplyChange={onApplyChangeMock}
      />,
      {context: routerContext}
    );
    openMenu();

    // Check the first project
    userEvent.click(screen.getByRole('checkbox', {name: testProject.slug}));

    expect(onChangeMock).toHaveBeenCalled();
    expect(onApplyChangeMock).not.toHaveBeenCalled();
  });

  it('displays multi projects with non member projects', function () {
    const nonMemberProject = TestStubs.Project({id: '2'});

    render(<ProjectSelector {...props} nonMemberProjects={[nonMemberProject]} />, {
      context: routerContext,
    });
    openMenu();

    expect(screen.getByText("Projects I don't belong to")).toBeInTheDocument();
    expect(screen.getAllByTestId('badge-display-name')).toHaveLength(3);
  });

  it('displays projects in alphabetical order partitioned by project membership', function () {
    const projectA = TestStubs.Project({id: '1', slug: 'a-project'});
    const projectB = TestStubs.Project({id: '2', slug: 'b-project'});
    const projectANonM = TestStubs.Project({id: '3', slug: 'a-non-m-project'});
    const projectBNonM = TestStubs.Project({id: '4', slug: 'b-non-m-project'});

    const multiProjectProps = {
      ...props,
      memberProjects: [projectB, projectA],
      nonMemberProjects: [projectBNonM, projectANonM],
      value: [],
    };

    render(<ProjectSelector {...multiProjectProps} />, {context: routerContext});
    openMenu();

    expect(screen.getByText("Projects I don't belong to")).toBeInTheDocument();

    const projectLabels = screen.getAllByTestId('badge-display-name');
    expect(projectLabels).toHaveLength(4);

    expect(projectLabels[0]).toHaveTextContent(projectA.slug);
    expect(projectLabels[1]).toHaveTextContent(projectB.slug);
    expect(projectLabels[2]).toHaveTextContent(projectANonM.slug);
    expect(projectLabels[3]).toHaveTextContent(projectBNonM.slug);
  });

  it('displays multi projects in sort order rules: selected, bookmarked, alphabetical', function () {
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
    const projectJ = TestStubs.Project({id: '9', slug: 'j-project'});
    const projectKSelectedBookmarked = TestStubs.Project({
      id: '10',
      slug: 'k-project',
      isBookmarked: true,
    });
    const projectL = TestStubs.Project({id: '11', slug: 'l-project'});

    const multiProjectProps = {
      ...props,
      // XXX: Intentionally sorted arbitrarily
      memberProjects: [
        projectBBookmarked,
        projectFSelectedBookmarked,
        projectDSelected,
        projectA,
        projectESelected,
        projectGSelectedBookmarked,
        projectCBookmarked,
        projectH,
      ],
      nonMemberProjects: [projectL, projectJ, projectKSelectedBookmarked],
      value: [
        projectESelected.id,
        projectDSelected.id,
        projectGSelectedBookmarked.id,
        projectFSelectedBookmarked.id,
        projectKSelectedBookmarked.id,
      ].map(p => parseInt(p, 10)),
    };

    render(<ProjectSelector {...multiProjectProps} />, {context: routerContext});
    openMenu();

    const projectLabels = screen.getAllByTestId('badge-display-name');
    expect(projectLabels).toHaveLength(11);

    // member projects
    expect(projectLabels[0]).toHaveTextContent(projectFSelectedBookmarked.slug);
    expect(projectLabels[1]).toHaveTextContent(projectGSelectedBookmarked.slug);
    expect(projectLabels[2]).toHaveTextContent(projectDSelected.slug);
    expect(projectLabels[3]).toHaveTextContent(projectESelected.slug);
    expect(projectLabels[4]).toHaveTextContent(projectBBookmarked.slug);
    expect(projectLabels[5]).toHaveTextContent(projectCBookmarked.slug);
    expect(projectLabels[6]).toHaveTextContent(projectA.slug);
    expect(projectLabels[7]).toHaveTextContent(projectH.slug);
    expect(projectLabels[6]).toHaveTextContent(projectA.slug);
    expect(projectLabels[7]).toHaveTextContent(projectH.slug);

    // non member projects
    expect(projectLabels[8]).toHaveTextContent(projectKSelectedBookmarked.slug);
    expect(projectLabels[9]).toHaveTextContent(projectJ.slug);
    expect(projectLabels[10]).toHaveTextContent(projectL.slug);
  });

  it('does not change sort order while selecting projects with the dropdown open', function () {
    const projectA = TestStubs.Project({id: '1', slug: 'a-project'});
    const projectBBookmarked = TestStubs.Project({
      id: '2',
      slug: 'b-project',
      isBookmarked: true,
    });
    const projectDSelected = TestStubs.Project({id: '4', slug: 'd-project'});

    const multiProjectProps = {
      ...props,
      // XXX: Intentionally sorted arbitrarily
      memberProjects: [projectBBookmarked, projectDSelected, projectA],
      nonMemberProjects: [],
      value: [projectDSelected.id].map(p => parseInt(p, 10)),
    };

    const {rerender} = render(<ProjectSelector {...multiProjectProps} />, {
      context: routerContext,
    });

    openMenu();

    const projectLabels = screen.getAllByTestId('badge-display-name');
    expect(projectLabels).toHaveLength(3);

    // member projects
    expect(projectLabels[0]).toHaveTextContent(projectDSelected.slug);
    expect(projectLabels[1]).toHaveTextContent(projectBBookmarked.slug);
    expect(projectLabels[2]).toHaveTextContent(projectA.slug);

    // Unselect project D (re-render with the updated selection value)
    userEvent.click(screen.getByRole('checkbox', {name: projectDSelected.slug}));
    rerender(<ProjectSelector {...multiProjectProps} value={[]} />, {
      context: routerContext,
    });

    // Project D is no longer checked
    expect(screen.getByRole('checkbox', {name: projectDSelected.slug})).not.toBeChecked();

    // Project D is still the first selected item
    expect(screen.getAllByTestId('badge-display-name')[0]).toHaveTextContent(
      projectDSelected.slug
    );

    // Open and close the menu
    applyMenu();
    openMenu();

    const resortedProjectLabels = screen.getAllByTestId('badge-display-name');

    // Project D has been moved to the bottom since it was unselected
    expect(resortedProjectLabels[0]).toHaveTextContent(projectBBookmarked.slug);
    expect(resortedProjectLabels[1]).toHaveTextContent(projectA.slug);
    expect(resortedProjectLabels[2]).toHaveTextContent(projectDSelected.slug);
  });

  it('can select all projects when role=owner', function () {
    const mockOnApplyChange = jest.fn();
    render(
      <ProjectSelector
        {...props}
        nonMemberProjects={[anotherProject]}
        organization={{...mockOrg, role: 'owner'}}
        onApplyChange={mockOnApplyChange}
      />,
      {context: routerContext}
    );

    openMenu();

    userEvent.click(screen.getByRole('button', {name: 'Select All Projects'}));

    expect(mockOnApplyChange).toHaveBeenCalledTimes(1);
    expect(mockOnApplyChange).toHaveBeenCalledWith([ALL_ACCESS_PROJECTS]);
  });

  it('can select all projects when role=manager', function () {
    const mockOnApplyChange = jest.fn();
    render(
      <ProjectSelector
        {...props}
        nonMemberProjects={[anotherProject]}
        organization={{...mockOrg, role: 'manager'}}
        onApplyChange={mockOnApplyChange}
      />,
      {context: routerContext}
    );

    openMenu();

    userEvent.click(screen.getByRole('button', {name: 'Select All Projects'}));

    expect(mockOnApplyChange).toHaveBeenCalledTimes(1);
    expect(mockOnApplyChange).toHaveBeenCalledWith([ALL_ACCESS_PROJECTS]);
  });

  it('can select all projects when org has open membership', function () {
    const mockOnApplyChange = jest.fn();
    render(
      <ProjectSelector
        {...props}
        nonMemberProjects={[anotherProject]}
        organization={{...mockOrg, features: [...mockOrg.features, 'open-membership']}}
        onApplyChange={mockOnApplyChange}
      />,
      {context: routerContext}
    );

    openMenu();

    userEvent.click(screen.getByRole('button', {name: 'Select All Projects'}));

    expect(mockOnApplyChange).toHaveBeenCalledTimes(1);
    expect(mockOnApplyChange).toHaveBeenCalledWith([ALL_ACCESS_PROJECTS]);
  });

  it('can select all projects after first selecting a project', async function () {
    const mockOnApplyChange = jest.fn();
    render(
      <ProjectSelector
        {...props}
        nonMemberProjects={[anotherProject]}
        organization={{...mockOrg, role: 'manager'}}
        onApplyChange={mockOnApplyChange}
      />,
      {context: routerContext}
    );

    openMenu();

    // Check the first project
    userEvent.click(screen.getByRole('checkbox', {name: testProject.slug}));

    userEvent.click(screen.getByRole('button', {name: 'Select All Projects'}));

    // Menu should close and all projects should be selected, not previously selected project
    await waitForElementToBeRemoved(() => screen.getByRole('listbox'));
    expect(mockOnApplyChange).toHaveBeenCalledTimes(1);
    expect(mockOnApplyChange).toHaveBeenCalledWith([ALL_ACCESS_PROJECTS]);
  });
});
