import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {updateProjects} from 'sentry/components/pageFilters/actions';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import PageFiltersStore from 'sentry/components/pageFilters/store';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';

const organization = OrganizationFixture({openMembership: true});
const projects = [
  ProjectFixture({id: '1', slug: 'project-1', isMember: true}),
  ProjectFixture({id: '2', slug: 'project-2', isMember: true}),
  ProjectFixture({id: '3', slug: 'project-3', isMember: false}),
];

describe('ProjectPageFilter', () => {
  beforeEach(() => {
    OrganizationStore.init();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData(projects);
  });

  afterEach(() => PageFiltersStore.reset());

  it('renders & handles single selection', async () => {
    const {router} = render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));

    // Select only project-1
    await userEvent.click(screen.getByRole('row', {name: 'project-1'}));

    // Trigger label & router is updated
    expect(screen.getByRole('button', {name: 'project-1'})).toBeInTheDocument();
    expect(router.location.query).toEqual({project: '1'});
  });

  it('handles multiple selection', async () => {
    const {router} = render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    // Open menu — initial state is All Projects (open-membership org)
    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));

    // Uncheck All Projects to clear the selection, then select only project-3
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select All Projects'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-3'}));

    // Click "Apply"
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // Trigger button & router are updated
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'project-3'})).toBeInTheDocument();
    });
    expect(router.location.query).toEqual({project: '3'});
  });

  it('renders keyboard-accessible trailing items', async () => {
    const mockApi = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/projects/${organization.slug}/project-1/`,
    });

    const {router} = render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    // Open the menu, search input has focus
    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search…')).toHaveFocus();
    });

    // Move focus past the one special item ("All Projects") to project-1
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    const optionOne = screen.getByRole('row', {name: 'project-1'});
    expect(optionOne).toHaveFocus();

    // Move focus to Option One's "Project Details" link
    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowRight}');
    expect(
      within(optionOne).getByRole('button', {name: 'Open Project Details'})
    ).toHaveFocus();

    // Activating the link triggers a route change
    await userEvent.keyboard('{Enter}');

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/insights/projects/project-1/'
    );
    expect(router.location.query).toEqual({project: '1'});

    // Move focus to "Project Settings" link
    await userEvent.keyboard('{ArrowRight}');
    expect(
      within(optionOne).getByRole('button', {name: 'Open Project Settings'})
    ).toHaveFocus();

    // Activating the link triggers a route change
    await userEvent.keyboard('{Enter}');
    expect(router.location.pathname).toBe(
      `/settings/${organization.slug}/projects/project-1/`
    );

    // Move focus to "Bookmark Project" button
    await userEvent.keyboard('{ArrowRight}');
    expect(within(optionOne).getByRole('button', {name: 'Bookmark'})).toHaveFocus();

    // Activate the button
    await userEvent.keyboard('{Enter}');
    expect(
      within(optionOne).getByRole('button', {name: 'Remove Bookmark'})
    ).toHaveAttribute('aria-pressed', 'true');
    expect(mockApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project-1/`,
      expect.objectContaining({
        data: {isBookmarked: true},
      })
    );

    MockApiClient.clearMockResponses();
  });

  it('handles reset', async () => {
    const onReset = jest.fn();
    const {router} = render(<ProjectPageFilter onReset={onReset} />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    // Open the menu, select project-1
    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));
    await userEvent.click(screen.getByRole('row', {name: 'project-1'}));
    expect(router.location.query).toEqual({project: '1'});

    // Open menu again & click "Reset"
    await userEvent.click(screen.getByRole('button', {name: 'project-1'}));
    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    // Trigger button was updated, onReset was called
    expect(screen.getByRole('button', {name: 'All Projects'})).toBeInTheDocument();
    expect(onReset).toHaveBeenCalled();
  });

  it('responds to page filter changes, async e.g. from back button nav', async () => {
    const mockRouter = RouterFixture({
      location: {pathname: '/organizations/org-slug/issues/', query: {}},
    });

    render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    // Confirm initial selection
    expect(await screen.findByRole('button', {name: 'All Projects'})).toBeInTheDocument();

    // Edit store value
    act(() => updateProjects([2], mockRouter));

    // <ProjectPageFilter /> is updated

    expect(await screen.findByRole('button', {name: 'project-2'})).toBeInTheDocument();
  });

  it('clicking My Projects when All Projects is active selects only non-member projects', async () => {
    const closedOrg = OrganizationFixture({orgRole: 'member'});

    // Start with All Projects active from URL
    PageFiltersStore.onInitializeUrlState({
      projects: [-1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization: closedOrg,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {project: '-1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));

    // Click "My Projects" while All Projects is active
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select My Projects'}));

    // Both sentinels should be unchecked
    expect(screen.getByRole('checkbox', {name: 'Select All Projects'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select My Projects'})).not.toBeChecked();
    // Member projects should be unchecked
    expect(screen.getByRole('checkbox', {name: 'Select project-1'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-2'})).not.toBeChecked();
    // Non-member project should be checked
    expect(screen.getByRole('checkbox', {name: 'Select project-3'})).toBeChecked();
  });

  it('clicking My Projects while All Projects is staged selects only non-member projects', async () => {
    const closedOrg = OrganizationFixture({orgRole: 'member'});

    // Start with a single project selected
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization: closedOrg,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {project: '1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'project-1'}));

    // Stage All Projects first
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select All Projects'}));

    // Now click My Projects — should subtract member projects
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select My Projects'}));

    // Both sentinels should be unchecked
    expect(screen.getByRole('checkbox', {name: 'Select All Projects'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select My Projects'})).not.toBeChecked();
    // Member projects should be unchecked
    expect(screen.getByRole('checkbox', {name: 'Select project-1'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-2'})).not.toBeChecked();
    // Non-member project should be checked
    expect(screen.getByRole('checkbox', {name: 'Select project-3'})).toBeChecked();
  });

  it('All Projects toggles all projects on; clicking again deselects everything', async () => {
    const closedOrg = OrganizationFixture({orgRole: 'member'});

    // Start with a single project selected
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization: closedOrg,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {project: '1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'project-1'}));

    // Click "All Projects" — should check all projects
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select All Projects'}));

    expect(screen.getByRole('checkbox', {name: 'Select All Projects'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-1'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-2'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-3'})).toBeChecked();

    // Click "All Projects" again — should deselect everything
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select All Projects'}));

    expect(screen.getByRole('checkbox', {name: 'Select All Projects'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select My Projects'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-1'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-2'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-3'})).not.toBeChecked();
  });

  it('unchecking all project checkboxes from All Projects leaves everything unchecked', async () => {
    const closedOrg = OrganizationFixture({orgRole: 'member'});

    // Start with All Projects active from URL
    PageFiltersStore.onInitializeUrlState({
      projects: [-1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization: closedOrg,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {project: '-1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));

    // Uncheck every project explicitly
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-1'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-2'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-3'}));

    // Sentinels and project checkboxes should all be unchecked in staged state
    expect(screen.getByRole('checkbox', {name: 'Select All Projects'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select My Projects'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-1'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-2'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-3'})).not.toBeChecked();
  });

  it('My Projects toggles member projects on; clicking again deselects everything', async () => {
    const closedOrg = OrganizationFixture({orgRole: 'member'});

    // Start with a single project selected
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization: closedOrg,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {project: '1'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'project-1'}));

    // Click "My Projects" — should check member projects only
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select My Projects'}));

    expect(screen.getByRole('checkbox', {name: 'Select My Projects'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-1'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-2'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-3'})).not.toBeChecked();

    // Click "My Projects" again — should deselect everything
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select My Projects'}));

    expect(screen.getByRole('checkbox', {name: 'Select All Projects'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select My Projects'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-1'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-2'})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Select project-3'})).not.toBeChecked();
  });

  it('does not show All Projects separator when My Projects is visible', async () => {
    const closedOrg = OrganizationFixture({orgRole: 'member'});

    render(<ProjectPageFilter />, {
      organization: closedOrg,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));

    const allProjectsRow = screen.getByRole('row', {name: /All Projects/i});
    expect(
      within(allProjectsRow).queryByRole('separator', {hidden: true})
    ).not.toBeInTheDocument();
  });

  it('hides special project options when search is active', async () => {
    render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));
    await userEvent.type(screen.getByPlaceholderText('Search…'), 'project-1');

    expect(
      screen.queryByRole('checkbox', {name: 'Select All Projects'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Select My Projects'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Select project-1'})).toBeInTheDocument();
  });

  it('does not show All Projects or My Projects options when only one project exists', async () => {
    const closedOrg = OrganizationFixture({orgRole: 'member'});

    const singleProject = [ProjectFixture({id: '3', slug: 'project-3', isMember: false})];
    ProjectsStore.loadInitialData(singleProject);

    render(<ProjectPageFilter />, {
      organization: closedOrg,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));

    expect(
      screen.queryByRole('checkbox', {name: 'Select All Projects'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {name: 'Select My Projects'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: 'Select project-3'})).toBeInTheDocument();
  });

  it('shows selection limit warning when all projects are selected explicitly', async () => {
    const manyProjects = Array.from({length: 52}, (_, index) =>
      ProjectFixture({
        id: String(index + 1),
        slug: `project-${index + 1}`,
        isMember: true,
      })
    );
    ProjectsStore.loadInitialData(manyProjects);

    PageFiltersStore.onInitializeUrlState({
      projects: Array.from({length: 51}, (_, index) => index + 1),
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/',
          query: {project: Array.from({length: 51}, (_, index) => String(index + 1))},
        },
      },
    });

    await userEvent.click(
      screen.getByRole('button', {name: /project-1, project-2 \+49/i})
    );
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-52'}));

    expect(
      screen.getByText(/only up to 50 can be selected at a time/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();
  });

  it('does not show selection limit warning when loaded with All Projects sentinel', async () => {
    const manyProjects = Array.from({length: 52}, (_, index) =>
      ProjectFixture({
        id: String(index + 1),
        slug: `project-${index + 1}`,
        isMember: true,
      })
    );
    ProjectsStore.loadInitialData(manyProjects);

    PageFiltersStore.onInitializeUrlState({
      projects: [-1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/',
          query: {project: '-1'},
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));

    expect(
      screen.queryByText(/only up to 50 can be selected at a time/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Apply'})).not.toBeInTheDocument();
  });

  it('keeps All Projects sentinel in URL when opening and closing the menu', async () => {
    const manyProjects = Array.from({length: 52}, (_, index) =>
      ProjectFixture({
        id: String(index + 1),
        slug: `project-${index + 1}`,
        isMember: true,
      })
    );
    ProjectsStore.loadInitialData(manyProjects);

    PageFiltersStore.onInitializeUrlState({
      projects: [-1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    const {router} = render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/',
          query: {project: '-1'},
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));
    await userEvent.click(document.body);

    await waitFor(() => {
      expect(router.location.query).toEqual({project: '-1'});
    });
  });

  it('shows selection limit warning when clicking All Projects then unchecking a single project', async () => {
    // 51 members + 1 non-member = 52 total so the "All Projects" sentinel appears
    const manyProjects = [
      ...Array.from({length: 51}, (_, index) =>
        ProjectFixture({
          id: String(index + 1),
          slug: `project-${index + 1}`,
          isMember: true,
        })
      ),
      ProjectFixture({id: '52', slug: 'project-52', isMember: false}),
    ];
    ProjectsStore.loadInitialData(manyProjects);

    // Start with a single project selected
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/',
          query: {project: '1'},
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'project-1'}));

    // Click "All Projects" to stage all 52 projects
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select All Projects'}));

    // Uncheck project-1 — should be unchecked and leave 51 selections, exceeding the limit
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-1'}));

    expect(screen.getByRole('checkbox', {name: 'Select project-1'})).not.toBeChecked();
    expect(
      screen.getByText(/only up to 50 can be selected at a time/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();
  });

  it.each([
    {
      label: 'My Projects',
      // 52 members + 1 non-member so the "My Projects" sentinel appears
      // (requires memberProjectList.length < projects.length)
      memberCount: 52,
      nonMemberCount: 1,
      urlProjects: [] as number[],
      urlQuery: {} as Record<string, string>,
      triggerName: 'My Projects',
    },
    {
      label: 'All Projects',
      // 51 members + 1 non-member so the "All Projects" sentinel appears
      // (requires nonMemberProjectList.length > 0)
      memberCount: 51,
      nonMemberCount: 1,
      urlProjects: [-1],
      urlQuery: {project: '-1'},
      triggerName: 'All Projects',
    },
  ])(
    'shows selection limit warning when $label is active and a single project is unchecked',
    async ({memberCount, nonMemberCount, urlProjects, urlQuery, triggerName}) => {
      // My Projects sentinel only exists in closed-membership orgs
      const closedOrg = OrganizationFixture({orgRole: 'member'});

      const manyProjects = [
        ...Array.from({length: memberCount}, (_, index) =>
          ProjectFixture({
            id: String(index + 1),
            slug: `project-${index + 1}`,
            isMember: true,
          })
        ),
        ...Array.from({length: nonMemberCount}, (_, index) =>
          ProjectFixture({
            id: String(memberCount + index + 1),
            slug: `project-${memberCount + index + 1}`,
            isMember: false,
          })
        ),
      ];
      ProjectsStore.loadInitialData(manyProjects);

      PageFiltersStore.onInitializeUrlState({
        projects: urlProjects,
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      });

      render(<ProjectPageFilter />, {
        organization: closedOrg,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/issues/', query: urlQuery},
        },
      });

      await userEvent.click(screen.getByRole('button', {name: triggerName}));

      // Unchecking one project leaves memberCount explicit selections, which exceeds the limit of 50
      await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-1'}));

      expect(
        screen.getByText(/only up to 50 can be selected at a time/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();
    }
  );

  it('shows selection limit warning after editing All Projects sentinel selection', async () => {
    const manyProjects = Array.from({length: 52}, (_, index) =>
      ProjectFixture({
        id: String(index + 1),
        slug: `project-${index + 1}`,
        isMember: true,
      })
    );
    ProjectsStore.loadInitialData(manyProjects);

    PageFiltersStore.onInitializeUrlState({
      projects: [-1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/',
          query: {project: '-1'},
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-52'}));

    expect(
      screen.getByText(/only up to 50 can be selected at a time/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Apply'})).toBeDisabled();
  });

  it('sorts projects with bookmarked appearing before non-bookmarked', async () => {
    // Set up projects with different bookmark states
    const projectsWithBookmarks = [
      ProjectFixture({id: '1', slug: 'selected-project', isMember: true}),
      ProjectFixture({
        id: '2',
        slug: 'bookmarked-project',
        isMember: true,
        isBookmarked: true,
      }),
      ProjectFixture({id: '3', slug: 'regular-project-a', isMember: true}),
      ProjectFixture({id: '4', slug: 'regular-project-b', isMember: true}),
    ];

    ProjectsStore.loadInitialData(projectsWithBookmarks);

    // Set project-1 as selected
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {project: '1'}},
      },
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'selected-project'}));

    // All projects are members so no special items are shown
    const projectRows = screen.getAllByRole('row');

    // Verify sort order:
    // 1. Selected project (selected-project)
    // 2. Bookmarked project (bookmarked-project)
    // 3. Regular projects (alphabetically)
    expect(projectRows).toHaveLength(4);
    expect(within(projectRows[0]!).getByText('selected-project')).toBeInTheDocument();
    expect(within(projectRows[1]!).getByText('bookmarked-project')).toBeInTheDocument();
    expect(within(projectRows[2]!).getByText('regular-project-a')).toBeInTheDocument();
    expect(within(projectRows[3]!).getByText('regular-project-b')).toBeInTheDocument();
  });

  it('maintains stable sort when bookmarking, then applies new sort on menu reopen', async () => {
    const mockApi = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/projects/${organization.slug}/regular-project-a/`,
    });

    // Set up projects with one bookmarked project
    const projectsWithBookmarks = [
      ProjectFixture({id: '1', slug: 'selected-project', isMember: true}),
      ProjectFixture({
        id: '2',
        slug: 'already-bookmarked',
        isMember: true,
        isBookmarked: true,
      }),
      ProjectFixture({id: '3', slug: 'regular-project-a', isMember: true}),
      ProjectFixture({id: '4', slug: 'regular-project-b', isMember: true}),
    ];

    ProjectsStore.loadInitialData(projectsWithBookmarks);

    // Set project-1 as selected
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    render(<ProjectPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {project: '1'}},
      },
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'selected-project'}));

    // All projects are members so no special items are shown
    let projectRows = screen.getAllByRole('row');
    expect(projectRows).toHaveLength(4);
    expect(within(projectRows[0]!).getByText('selected-project')).toBeInTheDocument();
    expect(within(projectRows[1]!).getByText('already-bookmarked')).toBeInTheDocument();
    expect(within(projectRows[2]!).getByText('regular-project-a')).toBeInTheDocument();
    expect(within(projectRows[3]!).getByText('regular-project-b')).toBeInTheDocument();

    // Navigate via keyboard to regular-project-a to make the Bookmark button visible.
    // (hover is unreliable across tests due to shared pointer state in userEvent)
    await waitFor(() => expect(screen.getByPlaceholderText('Search…')).toHaveFocus());
    // No sentinel items (all 4 projects are members), so:
    // ArrowDown x1 → selected-project, x2 → already-bookmarked, x3 → regular-project-a
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowDown}');

    // Bookmark regular-project-a while menu is open
    const regularProjectARow = screen.getByRole('row', {name: 'regular-project-a'});
    expect(regularProjectARow).toHaveFocus();
    const bookmarkButton = within(regularProjectARow).getByRole('button', {
      name: 'Bookmark',
    });
    await userEvent.click(bookmarkButton);

    // Verify the API was called
    expect(mockApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/regular-project-a/`,
      expect.objectContaining({
        data: {isBookmarked: true},
      })
    );

    // Verify sort order DOES NOT change while menu is still open (stable sorting)
    projectRows = screen.getAllByRole('row');

    expect(within(projectRows[0]!).getByText('selected-project')).toBeInTheDocument();
    expect(within(projectRows[1]!).getByText('already-bookmarked')).toBeInTheDocument();
    expect(within(projectRows[2]!).getByText('regular-project-a')).toBeInTheDocument();
    expect(within(projectRows[3]!).getByText('regular-project-b')).toBeInTheDocument();

    // Close menu by clicking outside
    await userEvent.click(document.body);

    // Update the project store to reflect the bookmark change
    act(() => {
      ProjectsStore.loadInitialData([
        ProjectFixture({id: '1', slug: 'selected-project', isMember: true}),
        ProjectFixture({
          id: '2',
          slug: 'already-bookmarked',
          isMember: true,
          isBookmarked: true,
        }),
        ProjectFixture({
          id: '3',
          slug: 'regular-project-a',
          isMember: true,
          isBookmarked: true,
        }),
        ProjectFixture({id: '4', slug: 'regular-project-b', isMember: true}),
      ]);
    });

    // Reopen menu
    await userEvent.click(screen.getByRole('button', {name: 'selected-project'}));

    // Verify new sort order with bookmarked projects grouped together
    projectRows = screen.getAllByRole('row');
    expect(within(projectRows[0]!).getByText('selected-project')).toBeInTheDocument();
    expect(within(projectRows[1]!).getByText('already-bookmarked')).toBeInTheDocument();
    expect(within(projectRows[2]!).getByText('regular-project-a')).toBeInTheDocument();
    expect(within(projectRows[3]!).getByText('regular-project-b')).toBeInTheDocument();

    MockApiClient.clearMockResponses();
  });

  it('deselecting My Projects does not select All Projects in the URL', async () => {
    const closedOrg = OrganizationFixture({orgRole: 'member'});

    // Start with default empty URL = "My Projects" state in a closed org
    const {router} = render(<ProjectPageFilter />, {
      organization: closedOrg,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    // Open the menu; "My Projects" should be checked
    await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));
    expect(screen.getByRole('checkbox', {name: 'Select My Projects'})).toBeChecked();

    // Deselect "My Projects"
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select My Projects'}));
    expect(screen.getByRole('checkbox', {name: 'Select My Projects'})).not.toBeChecked();

    // Apply the (empty) selection
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // URL must NOT become project=-1 (All Projects); the user did not select All Projects
    await waitFor(() => {
      expect(router.location.query.project).not.toBe('-1');
    });
  });

  describe('open-membership org defaults', () => {
    it('shows All Projects (not My Projects) as the default trigger label', async () => {
      render(<ProjectPageFilter />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/issues/', query: {}},
        },
      });

      expect(
        await screen.findByRole('button', {name: 'All Projects'})
      ).toBeInTheDocument();
    });

    it('does not show the My Projects option in the dropdown', async () => {
      render(<ProjectPageFilter />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/issues/', query: {}},
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));

      expect(
        screen.queryByRole('checkbox', {name: 'Select My Projects'})
      ).not.toBeInTheDocument();
    });

    it('sends no project param for the default All Projects state', async () => {
      const {router} = render(<ProjectPageFilter />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/issues/', query: {}},
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'All Projects'}));
      await userEvent.click(document.body);

      await waitFor(() => {
        expect(router.location.query.project).toBeUndefined();
      });
    });

    it('resetting navigates to All Projects with no project param', async () => {
      PageFiltersStore.onInitializeUrlState({
        projects: [1],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      });

      const {router} = render(<ProjectPageFilter />, {
        organization,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/issues/', query: {project: '1'}},
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'project-1'}));
      await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

      await waitFor(() => {
        expect(router.location.query.project).toBeUndefined();
      });

      expect(screen.getByRole('button', {name: 'All Projects'})).toBeInTheDocument();
    });
  });

  describe('closed-membership org defaults', () => {
    let closedOrg: ReturnType<typeof OrganizationFixture>;

    beforeEach(() => {
      // Org without open-membership; user is a regular member
      closedOrg = OrganizationFixture({orgRole: 'member'});
      OrganizationStore.onUpdate(closedOrg, {replace: true});
    });

    it('shows My Projects (not All Projects) as the default in closed orgs', async () => {
      render(<ProjectPageFilter />, {
        organization: closedOrg,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/issues/', query: {}},
        },
      });

      // The trigger button should say "My Projects", not "All Projects"
      expect(
        await screen.findByRole('button', {name: 'My Projects'})
      ).toBeInTheDocument();
    });

    it('correctly round-trips My Projects selection in closed orgs', async () => {
      const {router} = render(<ProjectPageFilter />, {
        organization: closedOrg,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/issues/', query: {}},
        },
      });

      // Open menu and confirm My Projects checkbox is checked
      await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));
      expect(screen.getByRole('checkbox', {name: 'Select My Projects'})).toBeChecked();

      // Toggle My Projects off and back on to create staged changes, making Apply available
      await userEvent.click(screen.getByRole('checkbox', {name: 'Select My Projects'}));
      await userEvent.click(screen.getByRole('checkbox', {name: 'Select My Projects'}));

      // Apply My Projects — should use compact [] encoding, not explicit IDs
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      // URL should use the compact [] encoding (no project param), not explicit IDs
      await waitFor(() => {
        expect(router.location.query.project).toBeUndefined();
      });
    });

    it('selecting All Projects in a closed org writes project=-1 to the URL', async () => {
      const {router} = render(<ProjectPageFilter />, {
        organization: closedOrg,
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/issues/', query: {}},
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));
      await userEvent.click(screen.getByRole('checkbox', {name: 'Select All Projects'}));
      await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

      await waitFor(() => {
        expect(router.location.query.project).toBe('-1');
      });
    });

    it('resetting in a closed org navigates to My Projects (no project param)', async () => {
      PageFiltersStore.onInitializeUrlState({
        projects: [1],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      });

      const {router} = render(<ProjectPageFilter />, {
        organization: closedOrg,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {project: '1'},
          },
        },
      });

      // Open menu and click Reset
      await userEvent.click(screen.getByRole('button', {name: 'project-1'}));
      await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

      // Reset should land on My Projects (compact [] URL = no project param)
      await waitFor(() => {
        expect(router.location.query.project).toBeUndefined();
      });
    });
  });

  describe('single-project org label', () => {
    it('shows the project name when the org has one member project auto-selected', async () => {
      const singleProject = ProjectFixture({
        id: '42',
        slug: 'only-project',
        isMember: true,
      });
      ProjectsStore.loadInitialData([singleProject]);
      PageFiltersStore.onInitializeUrlState({
        projects: [42],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      });

      render(<ProjectPageFilter />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {project: '42'},
          },
        },
      });

      expect(
        await screen.findByRole('button', {name: 'only-project'})
      ).toBeInTheDocument();
    });

    it('shows the project name when the org has one non-member project auto-selected', async () => {
      const singleProject = ProjectFixture({
        id: '42',
        slug: 'only-project',
        isMember: false,
      });
      ProjectsStore.loadInitialData([singleProject]);
      PageFiltersStore.onInitializeUrlState({
        projects: [42],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      });

      render(<ProjectPageFilter />, {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {project: '42'},
          },
        },
      });

      expect(
        await screen.findByRole('button', {name: 'only-project'})
      ).toBeInTheDocument();
    });
  });
});
