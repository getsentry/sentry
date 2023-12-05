import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {initializeUrlState} from 'sentry/actionCreators/pageFilters';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';

const {organization, router, routerContext} = initializeOrg({
  router: {
    location: {
      query: {},
      pathname: '/test',
    },
    params: {},
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
          utc: false,
        },
      },
      new Set(['datetime'])
    );
  });

  it('can change period', async function () {
    render(<DatePageFilter />, {context: routerContext, organization});

    // Open time period dropdown
    await userEvent.click(screen.getByRole('button', {name: '7D', expanded: false}));

    // Click 30 day period
    await userEvent.click(screen.getByRole('option', {name: 'Last 30 days'}));

    // Confirm selection changed visible text and query params
    expect(
      screen.getByRole('button', {name: '30D', expanded: false})
    ).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {statsPeriod: '30d'}})
    );
    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      shouldPersist: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(['datetime']),
      selection: {
        datetime: {
          period: '30d',
          end: undefined,
          start: undefined,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('can change absolute range', async function () {
    render(<DatePageFilter />, {context: routerContext, organization});

    // Open time period dropdown
    await userEvent.click(screen.getByRole('button', {name: '7D', expanded: false}));

    // Click 30 day period
    await userEvent.click(screen.getByRole('option', {name: 'Absolute date'}));

    const fromDateInput = screen.getByTestId('date-range-primary-from');
    const toDateInput = screen.getByTestId('date-range-primary-to');
    fireEvent.change(fromDateInput, {target: {value: '2017-10-03'}});
    fireEvent.change(toDateInput, {target: {value: '2017-10-04'}});

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    // Confirm selection changed visible text and query params
    expect(
      screen.getByRole('button', {name: 'Oct 3 – Oct 4', expanded: false})
    ).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {start: '2017-10-03T00:00:00', end: '2017-10-04T23:59:59'},
      })
    );
    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      shouldPersist: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(['datetime']),
      selection: {
        datetime: {
          period: null,
          end: new Date('2017-10-04T23:59:59.000Z'),
          start: new Date('2017-10-03T00:00:00.000Z'),
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });

    // Absolute option is marked as selected
    await userEvent.click(
      screen.getByRole('button', {name: 'Oct 3 – Oct 4', expanded: false})
    );
    expect(screen.getByRole('option', {name: 'Absolute date'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('displays a desynced state message', async function () {
    const {
      organization: desyncOrganization,
      router: desyncRouter,
      routerContext: desyncRouterContext,
    } = initializeOrg({
      router: {
        location: {
          // the datetime parameters need to be non-null for desync detection to work
          query: {statsPeriod: '7d'},
          pathname: '/test',
        },
        params: {},
      },
    });

    PageFiltersStore.reset();
    initializeUrlState({
      memberProjects: [],
      nonMemberProjects: [],
      organization: desyncOrganization,
      queryParams: {statsPeriod: '14d'},
      router: desyncRouter,
      shouldEnforceSingleProject: false,
    });

    render(<DatePageFilter />, {
      context: desyncRouterContext,
      organization: desyncOrganization,
    });

    // Open menu
    await userEvent.click(screen.getByRole('button', {name: '14D', expanded: false}));

    // Desync message is inside the menu
    expect(screen.getByText('Filters Updated')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Restore Previous Values'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Got It'})).toBeInTheDocument();
  });
});
