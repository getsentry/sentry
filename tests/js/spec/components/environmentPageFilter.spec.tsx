import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EnvironmentPageFilter from 'sentry/components/environmentPageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('EnvironmentPageFilter', function () {
  const {organization, router, routerContext} = initializeOrg({
    organization: {features: ['global-views', 'selection-filters-v2']},
    project: undefined,
    projects: [
      {
        id: 2,
        slug: 'project-2',
        environments: ['prod', 'staging'],
      },
    ],
    router: {
      location: {query: {}},
      params: {orgId: 'org-slug'},
    },
  });
  OrganizationStore.onUpdate(organization, {replace: true});
  ProjectsStore.loadInitialData(organization.projects);

  beforeEach(() => {
    act(() => {
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
  });

  it('can pick environment', function () {
    mountWithTheme(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open the environment dropdown
    expect(screen.getByText('All Environments')).toBeInTheDocument();
    userEvent.click(screen.getByText('All Environments'));

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
    mountWithTheme(<EnvironmentPageFilter />, {
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
    expect(screen.getByText('All Environments')).toBeInTheDocument();
    userEvent.click(screen.getByText('All Environments'));

    // Click the pin button
    const pinButton = screen.getByRole('button', {name: 'Pin'});
    userEvent.click(pinButton);

    await screen.findByRole('button', {name: 'Pin', pressed: true});

    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        pinnedFilters: new Set(['environments']),
      })
    );
  });

  it('can quick select', async function () {
    mountWithTheme(<EnvironmentPageFilter />, {
      context: routerContext,
      organization,
    });

    // Open the environment dropdown
    expect(screen.getByText('All Environments')).toBeInTheDocument();
    userEvent.click(screen.getByText('All Environments'));

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
