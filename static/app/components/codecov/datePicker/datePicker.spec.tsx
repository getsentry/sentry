import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {initializeUrlState} from 'sentry/actionCreators/pageFilters';
import {DatePicker} from 'sentry/components/codecov/datePicker/datePicker';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';

const {organization, router} = initializeOrg({
  router: {
    location: {
      query: {},
      pathname: '/codecov/tests',
    },
    params: {},
  },
});

describe('DatePicker', function () {
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
    render(<DatePicker />, {
      router,
      enableRouterMocks: true,
    });

    await userEvent.click(screen.getByRole('button', {name: '7D', expanded: false}));
    await userEvent.click(screen.getByRole('option', {name: 'Last 30 days'}));

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
          end: null,
          start: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('adjusts period if invalid', async function () {
    PageFiltersStore.reset();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {
          period: '123d',
          start: null,
          end: null,
          utc: false,
        },
      },
      new Set(['datetime'])
    );

    render(<DatePicker />, {
      router,
      enableRouterMocks: true,
    });

    // Confirm selection changed to default Codecov period
    const button = await screen.findByRole('button', {name: '24H', expanded: false});
    expect(button).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {statsPeriod: '24h'}})
    );
    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      shouldPersist: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(['datetime']),
      selection: {
        datetime: {
          period: '24h',
          end: null,
          start: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('displays a desynced state message', async function () {
    const {organization: desyncOrganization, router: desyncRouter} = initializeOrg({
      router: {
        location: {
          query: {statsPeriod: '7d'},
          pathname: '/codecov/test',
        },
        params: {},
      },
    });

    PageFiltersStore.reset();
    initializeUrlState({
      memberProjects: [],
      nonMemberProjects: [],
      organization: desyncOrganization,
      queryParams: {statsPeriod: '30d'},
      router: desyncRouter,
      shouldEnforceSingleProject: false,
    });

    render(<DatePicker />, {
      router: desyncRouter,
      organization: desyncOrganization,
      enableRouterMocks: true,
    });

    await userEvent.click(screen.getByRole('button', {name: '30D', expanded: false}));
    expect(screen.getByText('Filters Updated')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Restore Previous Values'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Got It'})).toBeInTheDocument();
  });
});
