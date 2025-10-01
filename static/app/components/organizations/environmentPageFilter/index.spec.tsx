import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {initializeUrlState, updateEnvironments} from 'sentry/actionCreators/pageFilters';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const {organization, projects, router} = initializeOrg({
  organization: {features: ['open-membership']},
  projects: [
    {id: '1', slug: 'project-1', environments: ['prod', 'staging']},
    {id: '2', slug: 'project-2', environments: ['prod', 'stage']},
  ],
  router: {
    location: {
      pathname: '/organizations/org-slug/issues/',
      query: {},
    },
    params: {},
  },
});

describe('EnvironmentPageFilter', () => {
  beforeEach(() => {
    OrganizationStore.init();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set(['environments'])
    );

    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData(projects);
  });

  afterEach(() => PageFiltersStore.reset());

  it('renders & handles single selection', async () => {
    render(<EnvironmentPageFilter />, {
      router,
      organization,
      deprecatedRouterMocks: true,
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));

    // Environments from all selected projects were combined into a list
    expect(screen.getByRole('row', {name: 'prod'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'stage'})).toBeInTheDocument();
    expect(screen.getByRole('row', {name: 'staging'})).toBeInTheDocument();

    // Select only "prod"
    await userEvent.click(screen.getByRole('row', {name: 'prod'}));

    // Trigger label & router is updated
    expect(screen.getByRole('button', {name: 'prod'})).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: ['prod']}})
    );
  });

  it('handles multiple selection', async () => {
    render(<EnvironmentPageFilter />, {
      router,
      organization,
      deprecatedRouterMocks: true,
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));

    // Select prod & stage by clicking on their checkboxes
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select prod'}));
    fireEvent.click(screen.getByRole('checkbox', {name: 'Select stage'}));

    // Click "Apply"
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // Trigger button & router are updated
    expect(screen.getByRole('button', {name: 'prod, stage'})).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: ['prod', 'stage']}})
    );
  });

  it('handles reset', async () => {
    const onReset = jest.fn();
    render(<EnvironmentPageFilter onReset={onReset} />, {
      router,
      organization,
      deprecatedRouterMocks: true,
    });

    // Open the menu, select project-1
    await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));
    await userEvent.click(screen.getByRole('row', {name: 'prod'}));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {environment: ['prod']},
      })
    );

    // Open menu again & click "Reset"
    await userEvent.click(screen.getByRole('button', {name: 'prod'}));
    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    // Trigger button was updated, onReset was called
    expect(screen.getByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    expect(onReset).toHaveBeenCalled();
  });

  it('responds to page filter changes, async e.g. from back button nav', async () => {
    render(<EnvironmentPageFilter />, {
      router,
      organization,
      deprecatedRouterMocks: true,
    });

    // Confirm initial selection
    expect(await screen.findByRole('button', {name: 'All Envs'})).toBeInTheDocument();

    // Edit store value
    act(() => updateEnvironments(['prod'], router));

    // <EnvironmentPageFilter /> is updated
    expect(screen.getByRole('button', {name: 'prod'})).toBeInTheDocument();
  });

  it('displays a desynced state message', async () => {
    const {organization: desyncOrganization, router: desyncRouter} = initializeOrg({
      organization: {features: ['open-membership']},
      projects: [
        {id: '1', slug: 'project-1', environments: ['prod', 'staging']},
        {id: '2', slug: 'project-2', environments: ['prod', 'stage']},
      ],
      router: {
        location: {
          pathname: '/organizations/org-slug/issues/',
          // the environment parameter needs to be non-null for desync detection to work
          query: {environment: 'prod'},
        },
        params: {},
      },
    });

    PageFiltersStore.reset();
    initializeUrlState({
      memberProjects: projects,
      nonMemberProjects: [],
      organization: desyncOrganization,
      queryParams: {project: ['1'], environment: 'staging'},
      router: desyncRouter,
    });

    render(<EnvironmentPageFilter />, {
      router: desyncRouter,
      organization: desyncOrganization,
      deprecatedRouterMocks: true,
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'staging'}));

    // Desync message is inside the menu
    expect(screen.getByText('Filters Updated')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Restore Previous Values'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Got It'})).toBeInTheDocument();
  });
});
