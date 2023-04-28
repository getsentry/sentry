import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const {organization, router, routerContext} = initializeOrg({
  organization: {features: ['global-views', 'open-membership']},
  project: undefined,
  projects: [
    {id: 1, slug: 'project-1', environments: ['prod', 'staging']},
    {id: 2, slug: 'project-2', environments: ['prod', 'stage']},
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
      new Set()
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

  it('handles clear', async function () {
    render(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));

    // Select prod & stage
    await fireEvent.click(screen.getByRole('checkbox', {name: 'Select prod'}));
    await fireEvent.click(screen.getByRole('checkbox', {name: 'Select stage'}));
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // prod & stage are selected
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {environment: ['prod', 'stage']},
      })
    );

    // Open menu again, click "Clear"
    await userEvent.click(screen.getByRole('button', {name: 'Clear'}));

    // Trigger button was updated
    expect(screen.getByRole('button', {name: 'All Envs'})).toBeInTheDocument();

    // Router was updated with new empty value
    waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {environment: []},
        })
      )
    );
  });

  it('responds to page filter changes, async e.g. from back button nav', function () {
    render(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
    });

    // Confirm initial selection
    expect(screen.getByRole('button', {name: 'All Envs'})).toBeInTheDocument();

    // Edit store value
    act(() => PageFiltersStore.updateEnvironments(['prod']));

    // <EnvironmentPageFilter /> is updated
    waitFor(() => expect(screen.getByRole('button', {name: 'prod'})).toBeInTheDocument());
  });
});
