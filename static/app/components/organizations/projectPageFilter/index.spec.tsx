import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {initializeUrlState, updateProjects} from 'sentry/actionCreators/pageFilters';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const {organization, router, routerContext} = initializeOrg({
  organization: {features: ['global-views', 'open-membership']},
  project: undefined,
  projects: [
    {id: '1', slug: 'project-1', isMember: true},
    {id: '2', slug: 'project-2', isMember: true},
    {id: '3', slug: 'project-3', isMember: false},
  ],
  router: {
    location: {
      pathname: '/organizations/org-slug/issues/',
      query: {},
    },
    params: {},
  },
});

describe('ProjectPageFilter', function () {
  beforeEach(() => {
    OrganizationStore.init();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set(['projects'])
    );

    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData(organization.projects);
  });

  afterEach(() => PageFiltersStore.reset());

  it('renders & handles single selection', async function () {
    render(<ProjectPageFilter />, {
      context: routerContext,
      organization,
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
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: [], project: ['1']}})
    );
  });

  it('handles multiple selection', async function () {
    render(<ProjectPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));

    // Deselect project-1 & project-2 by clicking on their checkboxes
    await fireEvent.click(screen.getByRole('checkbox', {name: 'Select project-1'}));
    await fireEvent.click(screen.getByRole('checkbox', {name: 'Select project-2'}));

    // Select project-3 by clicking on its checkbox
    await fireEvent.click(screen.getByRole('checkbox', {name: 'Select project-3'}));

    // Click "Apply"
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // Trigger button & router are updated
    expect(screen.getByRole('button', {name: 'project-3'})).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: [], project: ['3']}})
    );
  });

  it('renders keyboard-accessible trailing items', async function () {
    const mockApi = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/projects/${organization.slug}/project-1/`,
    });

    render(<ProjectPageFilter />, {
      context: routerContext,
      organization,
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
    expect(
      within(optionOne).getByRole('button', {name: 'Project Details'})
    ).toHaveFocus();

    // Activating the link triggers a route change
    await userEvent.keyboard('{Enter}');
    expect(router.push).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/projects/project-1/?project=1`
    );

    // Move focus to "Project Settings" link
    await userEvent.keyboard('{ArrowRight}');
    expect(
      within(optionOne).getByRole('button', {name: 'Project Settings'})
    ).toHaveFocus();

    // Activating the link triggers a route change
    await userEvent.keyboard('{Enter}');
    expect(router.push).toHaveBeenCalledWith(
      `/settings/${organization.slug}/projects/project-1/`
    );

    // Move focus to "Bookmark Project" button
    await userEvent.keyboard('{ArrowRight}');
    expect(
      within(optionOne).getByRole('button', {name: 'Bookmark Project'})
    ).toHaveFocus();

    // Activate the button
    await userEvent.keyboard('{Enter}');
    expect(
      within(optionOne).getByRole('button', {name: 'Bookmark Project'})
    ).toHaveAttribute('aria-pressed', 'true');
    expect(mockApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project-1/`,
      expect.objectContaining({
        data: {isBookmarked: true},
      })
    );

    MockApiClient.clearMockResponses();
  });

  it('handles reset', async function () {
    const onReset = jest.fn();
    render(<ProjectPageFilter onReset={onReset} />, {
      context: routerContext,
      organization,
    });

    // Open the menu, select project-1
    await userEvent.click(screen.getByRole('button', {name: 'My Projects'}));
    await userEvent.click(screen.getByRole('row', {name: 'project-1'}));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {environment: [], project: ['1']},
      })
    );

    // Open menu again & click "Reset"
    await userEvent.click(screen.getByRole('button', {name: 'project-1'}));
    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    // Trigger button was updated, onReset was called
    expect(screen.getByRole('button', {name: 'My Projects'})).toBeInTheDocument();
    expect(onReset).toHaveBeenCalled();
  });

  it('responds to page filter changes, async e.g. from back button nav', function () {
    render(<ProjectPageFilter />, {
      context: routerContext,
      organization,
    });

    // Confirm initial selection
    expect(screen.getByRole('button', {name: 'My Projects'})).toBeInTheDocument();

    // Edit store value
    act(() => updateProjects([2], router));

    // <ProjectPageFilter /> is updated

    expect(screen.getByRole('button', {name: 'project-2'})).toBeInTheDocument();
  });

  it('displays a desynced state message', async function () {
    const {
      organization: desyncOrganization,
      router: desyncRouter,
      routerContext: desyncRouterContext,
    } = initializeOrg({
      organization: {features: ['global-views', 'open-membership']},
      project: undefined,
      projects: [
        {id: '1', slug: 'project-1', isMember: true},
        {id: '2', slug: 'project-2', isMember: true},
        {id: '3', slug: 'project-3', isMember: false},
      ],
      router: {
        location: {
          pathname: '/organizations/org-slug/issues/',
          // the project parameter needs to be non-null for desync detection to work
          query: {project: '1'},
        },
        params: {},
      },
    });

    PageFiltersStore.reset();
    initializeUrlState({
      memberProjects: organization.projects.filter(p => p.isMember),
      nonMemberProjects: organization.projects.filter(p => !p.isMember),
      organization: desyncOrganization,
      queryParams: {project: ['2']},
      router: desyncRouter,
      shouldEnforceSingleProject: false,
    });

    render(<ProjectPageFilter />, {
      context: desyncRouterContext,
      organization: desyncOrganization,
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'project-2'}));

    // Desync message is inside the menu
    expect(screen.getByText('Filters Updated')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Restore Previous Values'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Got It'})).toBeInTheDocument();
  });
});
