import {browserHistory, InjectedRouter} from 'react-router';

import {enforceActOnUseLegacyStoreHook} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import VitalDetail from 'sentry/views/performance/vitalDetail';

const api = new MockApiClient();
const organization = TestStubs.Organization({
  features: ['discover-basic', 'performance-view'],
  projects: [TestStubs.Project()],
});

const {
  routerContext,
  organization: org,
  router,
  project,
} = initializeOrg({
  ...initializeOrg(),
  organization,
  router: {
    location: {
      query: {
        project: 1,
      },
    },
  },
});

function TestComponent(props: {router?: InjectedRouter; orgFeatures?: string[]} = {}) {
  return (
    <OrganizationContext.Provider
      value={{...org, features: [...org.features, ...(props.orgFeatures ?? [])]}}
    >
      <VitalDetail
        api={api}
        location={props.router?.location ?? router.location}
        router={props.router ?? router}
        params={{}}
        route={{}}
        routes={[]}
        routeParams={{}}
      />
    </OrganizationContext.Provider>
  );
}

describe('Performance > VitalDetail', () => {
  enforceActOnUseLegacyStoreHook();

  beforeEach(function () {
    TeamStore.loadInitialData([], false, null);
    ProjectsStore.loadInitialData(org.projects);
    browserHistory.push = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/user.email/values/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-vitals/',
      body: {
        'measurements.lcp': {
          poor: 1,
          meh: 2,
          good: 3,
          total: 6,
          p75: 4500,
        },
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          count: 'integer',
          p95_measurements_lcp: 'duration',
          transaction: 'string',
          p50_measurements_lcp: 'duration',
          project: 'string',
          compare_numeric_aggregate_p75_measurements_lcp_greater_4000: 'number',
          'project.id': 'integer',
          count_unique_user: 'integer',
          p75_measurements_lcp: 'duration',
        },
        data: [
          {
            count: 100000,
            p95_measurements_lcp: 5000,
            transaction: 'something',
            p50_measurements_lcp: 3500,
            project: 'javascript',
            compare_numeric_aggregate_p75_measurements_lcp_greater_4000: 1,
            count_unique_user: 10000,
            p75_measurements_lcp: 4500,
          },
        ],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.find(f => f === 'p50(measurements.lcp)');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          compare_numeric_aggregate_p75_measurements_cls_greater_0_1: 'number',
          compare_numeric_aggregate_p75_measurements_cls_greater_0_25: 'number',
          count: 'integer',
          count_unique_user: 'integer',
          team_key_transaction: 'boolean',
          p50_measurements_cls: 'number',
          p75_measurements_cls: 'number',
          p95_measurements_cls: 'number',
          project: 'string',
          transaction: 'string',
        },
        data: [
          {
            compare_numeric_aggregate_p75_measurements_cls_greater_0_1: 1,
            compare_numeric_aggregate_p75_measurements_cls_greater_0_25: 0,
            count: 10000,
            count_unique_user: 2740,
            team_key_transaction: 1,
            p50_measurements_cls: 0.143,
            p75_measurements_cls: 0.215,
            p95_measurements_cls: 0.302,
            project: 'javascript',
            transaction: 'something',
          },
        ],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.find(f => f === 'p50(measurements.cls)');
        },
      ],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function () {
    mountWithTheme(<TestComponent />, {
      context: routerContext,
    });

    // It shows a search bar
    expect(await screen.findByLabelText('Search events')).toBeInTheDocument();

    // It shows the vital card
    expect(
      screen.getByText(textWithMarkupMatcher('The p75 for all transactions is 4500ms'))
    ).toBeInTheDocument();

    expect(screen.getByText('Good 50%')).toBeInTheDocument();
    expect(screen.getByText('Meh 33%')).toBeInTheDocument();
    expect(screen.getByText('Poor 17%')).toBeInTheDocument();

    // It shows a chart
    expect(screen.getByText('Duration p75')).toBeInTheDocument();

    // It shows a table
    expect(screen.getByText('something').closest('td')).toBeInTheDocument();
  });

  it('triggers a navigation on search', async function () {
    mountWithTheme(<TestComponent />, {
      context: routerContext,
    });

    // Fill out the search box, and submit it.
    userEvent.type(
      await screen.findByLabelText('Search events'),
      'user.email:uhoh*{enter}'
    );

    // Check the navigation.
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        project: 1,
        statsPeriod: '14d',
        query: 'user.email:uhoh*',
      },
    });
  });

  it('Applies conditions when linking to transaction summary', async function () {
    mountWithTheme(<TestComponent />, {
      context: routerContext,
    });

    expect((await screen.findByText('something')).closest('a')).toBeInTheDocument();
  });

  it('Check CLS', async function () {
    const newRouter = {
      ...router,
      location: {
        ...router.location,
        query: {
          query: 'anothertag:value',
          vitalName: 'measurements.cls',
        },
      },
    };

    const newRouterContext = TestStubs.routerContext([
      {
        organization,
        project,
        router: newRouter,
        location: newRouter.location,
      },
    ]);

    mountWithTheme(<TestComponent router={newRouter} />, {
      context: newRouterContext,
    });

    expect(await screen.findByText('Cumulative Layout Shift')).toBeInTheDocument();

    expect(screen.getByText('something').closest('a')).toBeInTheDocument();

    expect(screen.getByText('0.215').closest('td')).toBeInTheDocument();
  });

  it('Pagination links exist to switch between vitals', async function () {
    const newRouter = {
      ...router,
      location: {
        ...router.location,
        query: {
          project: 1,
          query: 'tag:value',
        },
      },
    };

    const newRouterContext = TestStubs.routerContext([
      {
        organization,
        project,
        router: newRouter,
        location: newRouter.location,
      },
    ]);

    mountWithTheme(<TestComponent router={newRouter} />, {
      context: newRouterContext,
    });

    expect(await screen.findByLabelText('Previous')).toBeInTheDocument();

    userEvent.click(screen.getByLabelText('Previous'));

    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        project: 1,
        query: 'tag:value',
        vitalName: 'measurements.fcp',
      },
    });
  });

  it('Check LCP vital renders correctly', async function () {
    mountWithTheme(<TestComponent />, {
      context: routerContext,
    });

    expect(await screen.findByText('Largest Contentful Paint')).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('The p75 for all transactions is 4500ms'))
    ).toBeInTheDocument();

    expect(screen.getByText('4.50s').closest('td')).toBeInTheDocument();
  });
});
