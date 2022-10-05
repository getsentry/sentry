import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const {organization, router, routerContext} = initializeOrg({
  organization: {features: ['global-views']},
  project: undefined,
  projects: [
    {
      id: 2,
      slug: 'project-2',
      environments: ['prod', 'staging'],
    },
  ],
  router: {
    location: {
      pathname: '/organizations/org-slug/issues/',
      query: {},
    },
    params: {orgId: 'org-slug'},
  },
});

describe('EnvironmentPageFilter', function () {
  beforeEach(() => {
    OrganizationStore.init();
    OrganizationStore.onUpdate(organization, {replace: true});

    ProjectsStore.init();
    ProjectsStore.loadInitialData(organization.projects);

    PageFiltersStore.reset();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [2],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set()
    );
  });

  it('can pick environment', function () {
    render(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open the environment dropdown
    expect(screen.getByText('All Envs')).toBeInTheDocument();
    userEvent.click(screen.getByText('All Envs'));

    // Click the first environment's checkbox
    const envOptions = screen.getAllByTestId('checkbox-fancy');
    userEvent.click(envOptions[0]);

    // Close the dropdown
    userEvent.click(screen.getAllByText('prod')[0]);

    // Verify we were redirected
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: ['prod']}})
    );
  });

  it('can pin environment', async function () {
    render(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
    });
    // Confirm no filters are pinned
    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        pinnedFilters: new Set(),
      })
    );

    // Open the environment dropdown
    expect(screen.getByText('All Envs')).toBeInTheDocument();
    userEvent.click(screen.getByText('All Envs'));

    // Click the pin button
    const pinButton = screen.getByRole('button', {name: 'Lock filter'});
    userEvent.click(pinButton, undefined, {skipHover: true});

    await screen.findByRole('button', {name: 'Lock filter', pressed: true});

    // Check if the pin indicator has been added
    expect(screen.getByLabelText('Filter applied across pages')).toBeInTheDocument();

    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        pinnedFilters: new Set(['environments']),
      })
    );
  });

  it('can quick select', async function () {
    render(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open the environment dropdown
    expect(screen.getByText('All Envs')).toBeInTheDocument();
    userEvent.click(screen.getByText('All Envs'));

    // Click the first environment directly
    userEvent.click(screen.getByText('prod'));

    // Verify we were redirected
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {environment: ['prod']}})
    );

    await screen.findByText('prod');

    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        isReady: true,
        selection: {
          datetime: {
            end: null,
            period: '14d',
            start: null,
            utc: null,
          },
          environments: ['prod'],
          projects: [2],
        },
      })
    );
  });
});
