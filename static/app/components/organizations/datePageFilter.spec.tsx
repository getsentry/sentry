import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {initializeUrlState} from 'sentry/actionCreators/pageFilters';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';

describe('DatePageFilter', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    PageFiltersStore.init();
    OrganizationStore.init();

    OrganizationStore.onUpdate(organization, {replace: true});
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {
        period: '7d',
        start: null,
        end: null,
        utc: false,
      },
    });
  });

  it('can change period', async () => {
    const {router} = render(<DatePageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/test', query: {}},
      },
    });

    // Open time period dropdown
    await userEvent.click(screen.getByRole('button', {name: '7D', expanded: false}));

    // Click 30 day period
    await userEvent.click(screen.getByRole('option', {name: 'Last 30 days'}));

    // Confirm selection changed visible text and query params
    expect(
      screen.getByRole('button', {name: '30D', expanded: false})
    ).toBeInTheDocument();
    expect(router.location.query).toEqual(expect.objectContaining({statsPeriod: '30d'}));
    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      shouldPersist: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(['projects', 'environments', 'datetime']),
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

  it('can change absolute range', async () => {
    const {router} = render(<DatePageFilter />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/test', query: {}},
      },
    });

    // Open time period dropdown
    await userEvent.click(screen.getByRole('button', {name: '7D', expanded: false}));

    // Click 30 day period
    await userEvent.click(screen.getByRole('option', {name: 'Absolute date'}));

    const fromDateInput = await screen.findByTestId('date-range-primary-from');
    const toDateInput = screen.getByTestId('date-range-primary-to');
    fireEvent.change(fromDateInput, {target: {value: '2017-10-03'}});
    fireEvent.change(toDateInput, {target: {value: '2017-10-04'}});

    await userEvent.click(await screen.findByRole('button', {name: 'Apply'}));

    // Confirm selection changed visible text and query params
    expect(
      await screen.findByRole('button', {name: 'Oct 3 – Oct 4', expanded: false})
    ).toBeInTheDocument();
    expect(router.location.query).toEqual(
      expect.objectContaining({
        start: '2017-10-03T00:00:00',
        end: '2017-10-04T23:59:59',
      })
    );
    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      shouldPersist: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(['projects', 'environments', 'datetime']),
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

  it('displays a desynced state message', async () => {
    const desyncOrganization = OrganizationFixture();
    // the datetime parameters need to be non-null for desync detection to work
    const desyncLocation = {pathname: '/test', query: {statsPeriod: '7d'}};

    PageFiltersStore.reset();
    initializeUrlState({
      memberProjects: [],
      nonMemberProjects: [],
      organization: desyncOrganization,
      queryParams: {statsPeriod: '14d'},
      router: RouterFixture({
        location: desyncLocation,
      }),
    });

    render(<DatePageFilter />, {
      organization: desyncOrganization,
      initialRouterConfig: {
        location: desyncLocation,
      },
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
