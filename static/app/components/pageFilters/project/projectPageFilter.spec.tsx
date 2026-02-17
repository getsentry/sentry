import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {updateProjects} from 'sentry/components/pageFilters/actions';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import PageFiltersStore from 'sentry/components/pageFilters/store';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const organization = OrganizationFixture({features: ['open-membership']});
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
    await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));

    // There are 2 option groups
    expect(screen.getByRole('rowgroup', {name: 'My Projects'})).toBeInTheDocument();
    expect(screen.getByRole('rowgroup', {name: 'Other'})).toBeInTheDocument();

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

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));

    // Deselect project-1 & project-2 by clicking on their checkboxes
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-1'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-2'}));

    // Select project-3 by clicking on its checkbox
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select project-3'}));

    // Click "Apply"
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // Trigger button & router are updated
    expect(screen.getByRole('button', {name: 'project-3'})).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));
    expect(screen.getByPlaceholderText('Search…')).toHaveFocus();

    // Move focus to Option One
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
    await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));
    await userEvent.click(screen.getByRole('row', {name: 'project-1'}));
    expect(router.location.query).toEqual({project: '1'});

    // Open menu again & click "Reset"
    await userEvent.click(screen.getByRole('button', {name: 'project-1'}));
    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    // Trigger button was updated, onReset was called
    expect(screen.getByRole('button', {name: 'My Projects'})).toBeInTheDocument();
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
    expect(await screen.findByRole('button', {name: 'My Projects'})).toBeInTheDocument();

    // Edit store value
    act(() => updateProjects([2], mockRouter));

    // <ProjectPageFilter /> is updated

    expect(await screen.findByRole('button', {name: 'project-2'})).toBeInTheDocument();
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

    // Get all project rows (they're in a flat list when all are member projects)
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

    // Verify initial sort order
    let projectRows = screen.getAllByRole('row');
    expect(projectRows).toHaveLength(4);
    expect(within(projectRows[0]!).getByText('selected-project')).toBeInTheDocument();
    expect(within(projectRows[1]!).getByText('already-bookmarked')).toBeInTheDocument();
    expect(within(projectRows[2]!).getByText('regular-project-a')).toBeInTheDocument();
    expect(within(projectRows[3]!).getByText('regular-project-b')).toBeInTheDocument();

    // Bookmark regular-project-a while menu is open
    const regularProjectARow = screen.getByRole('row', {name: 'regular-project-a'});
    await userEvent.hover(regularProjectARow);
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
});
