import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {act, fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {updateEnvironments} from 'sentry/components/pageFilters/actions';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import PageFiltersStore from 'sentry/components/pageFilters/store';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const organization = OrganizationFixture({features: ['open-membership']});
const projects = [
  ProjectFixture({id: '1', slug: 'project-1', environments: ['prod', 'staging']}),
  ProjectFixture({id: '2', slug: 'project-2', environments: ['prod', 'stage']}),
];

describe('EnvironmentPageFilter', () => {
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
    const {router} = render(<EnvironmentPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
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
    expect(router.location.query).toEqual(expect.objectContaining({environment: 'prod'}));
  });

  it('handles multiple selection', async () => {
    const {router} = render(<EnvironmentPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
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
    expect(router.location.query).toEqual(
      expect.objectContaining({environment: ['prod', 'stage']})
    );
  });

  it('handles reset', async () => {
    const onReset = jest.fn();
    const {router} = render(<EnvironmentPageFilter onReset={onReset} />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    // Open the menu, select project-1
    await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));
    await userEvent.click(screen.getByRole('row', {name: 'prod'}));
    expect(router.location.query).toEqual(expect.objectContaining({environment: 'prod'}));

    // Open menu again & click "Reset"
    await userEvent.click(screen.getByRole('button', {name: 'prod'}));
    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    // Trigger button was updated, onReset was called
    expect(screen.getByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    expect(onReset).toHaveBeenCalled();
  });

  it('responds to page filter changes, async e.g. from back button nav', async () => {
    const mockRouter = RouterFixture({
      location: {pathname: '/organizations/org-slug/issues/', query: {}},
    });

    render(<EnvironmentPageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/issues/', query: {}},
      },
    });

    // Confirm initial selection
    expect(await screen.findByRole('button', {name: 'All Envs'})).toBeInTheDocument();

    // Edit store value
    act(() => updateEnvironments(['prod'], mockRouter));

    // <EnvironmentPageFilter /> is updated
    expect(screen.getByRole('button', {name: 'prod'})).toBeInTheDocument();
  });
});
