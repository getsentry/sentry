import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {initializeUrlState, updateEnvironments} from 'sentry/actionCreators/pageFilters';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const {organization, router, routerContext} = initializeOrg({
  organization: {features: ['global-views', 'open-membership']},
  project: undefined,
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

describe('EnvironmentPageFilter', function () {
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
    ProjectsStore.loadInitialData(organization.projects);
  });

  afterEach(() => PageFiltersStore.reset());

  it('renders & handles single selection', async function () {
    render(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
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

  it('handles multiple selection', async function () {
    render(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));

    // Select prod & stage by clicking on their checkboxes
    await fireEvent.click(screen.getByRole('checkbox', {name: 'Select prod'}));
    await fireEvent.click(screen.getByRole('checkbox', {name: 'Select stage'}));

    // Click "Apply"
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // Trigger button & router are updated
    expect(screen.getByRole('button', {name: 'prod, stage'})).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: ['prod', 'stage']}})
    );
  });

  it('handles reset', async function () {
    const onReset = jest.fn();
    render(<EnvironmentPageFilter onReset={onReset} />, {
      context: routerContext,
      organization,
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

  it('responds to page filter changes, async e.g. from back button nav', function () {
    render(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
    });

    // Confirm initial selection
    expect(screen.getByRole('button', {name: 'All Envs'})).toBeInTheDocument();

    // Edit store value
    act(() => updateEnvironments(['prod'], router));

    // <EnvironmentPageFilter /> is updated
    expect(screen.getByRole('button', {name: 'prod'})).toBeInTheDocument();
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
      memberProjects: organization.projects,
      nonMemberProjects: [],
      organization: desyncOrganization,
      queryParams: {project: ['1'], environment: 'staging'},
      router: desyncRouter,
      shouldEnforceSingleProject: false,
    });

    render(<EnvironmentPageFilter />, {
      context: desyncRouterContext,
      organization: desyncOrganization,
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
