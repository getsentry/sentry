import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import DatePageFilter from 'sentry/components/datePageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';

const {organization, router, routerContext} = initializeOrg({
  organization: {},
  project: undefined,
  projects: undefined,
  router: {
    location: {
      query: {},
      pathname: '/test',
    },
    params: {orgId: 'org-slug'},
  },
});

describe('DatePageFilter', function () {
  beforeEach(() => {
    PageFiltersStore.init();
    OrganizationStore.init();

    OrganizationStore.onUpdate(organization, {replace: true});
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {
          period: '7d',
          start: null,
          end: null,
          utc: null,
        },
      },
      new Set()
    );
  });

  afterEach(() => {
    PageFiltersStore.teardown();
    OrganizationStore.teardown();
  });

  it('can change period', async function () {
    render(<DatePageFilter />, {
      context: routerContext,
      organization,
    });

    // Open time period dropdown
    expect(screen.getByText('7D')).toBeInTheDocument();
    userEvent.click(screen.getByText('7D'));

    // Click 30 day period
    userEvent.click(screen.getByText('Last 30 days'));

    // Confirm selection changed visible text and query params
    expect(await screen.findByText('30D')).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {statsPeriod: '30d'}})
    );
    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      selection: {
        datetime: {period: '30d'},
        environments: [],
        projects: [],
      },
    });
  });

  it('can pin datetime', async function () {
    render(<DatePageFilter />, {
      context: routerContext,
      organization,
    });

    // Confirm no filters are pinned
    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        pinnedFilters: new Set(),
      })
    );

    // Open time period dropdown
    userEvent.click(screen.getByText('7D'));

    // Click the pin button
    const pinButton = screen.getByRole('button', {name: 'Lock filter'});
    userEvent.click(pinButton);

    await screen.findByRole('button', {name: 'Lock filter', pressed: true});

    // Check if the pin indicator has been added
    expect(screen.getByLabelText('Filter applied across pages')).toBeInTheDocument();

    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        pinnedFilters: new Set(['datetime']),
      })
    );
  });
});
