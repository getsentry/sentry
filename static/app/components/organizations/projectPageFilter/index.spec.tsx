import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

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
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select project-1'}));
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select project-2'}));

    // Select project-3 by clicking on its checkbox
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select project-3'}));

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
    expect(
      within(optionOne).getByRole('button', {name: 'Project Details'})
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
      within(optionOne).getByRole('button', {name: 'Project Settings'})
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

  it('displays a desynced state message', async () => {
    const desyncOrganization = OrganizationFixture({features: ['open-membership']});
    // the project parameter needs to be non-null for desync detection to work
    const desyncLocation = {
      pathname: '/organizations/org-slug/issues/',
      query: {project: '1'},
    };

    PageFiltersStore.reset();
    initializeUrlState({
      memberProjects: projects.filter(p => p.isMember),
      nonMemberProjects: projects.filter(p => !p.isMember),
      organization: desyncOrganization,
      queryParams: {project: ['2']},
      router: RouterFixture({
        location: desyncLocation,
      }),
    });

    render(<ProjectPageFilter />, {
      organization: desyncOrganization,
      initialRouterConfig: {
        location: desyncLocation,
      },
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
