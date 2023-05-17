import {browserHistory, InjectedRouter} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {WebVital} from 'sentry/utils/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/performance/data';
import VitalDetail from 'sentry/views/performance/vitalDetail';
import {vitalSupportedBrowsers} from 'sentry/views/performance/vitalDetail/utils';

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
  organization,
  router: {
    location: {
      query: {
        project: 1,
      },
    },
  },
});

function TestComponent(props: {router?: InjectedRouter} = {}) {
  return (
    <VitalDetail
      api={api}
      location={props.router?.location ?? router.location}
      router={props.router ?? router}
      params={{}}
      route={{}}
      routes={[]}
      routeParams={{}}
    />
  );
}

const testSupportedBrowserRendering = (webVital: WebVital) => {
  Object.values(Browser).forEach(browser => {
    const browserElement = screen.getByText(browser);
    expect(browserElement).toBeInTheDocument();

    const isSupported = vitalSupportedBrowsers[webVital]?.includes(browser);

    if (isSupported) {
      expect(within(browserElement).getByTestId('icon-check-mark')).toBeInTheDocument();
    } else {
      expect(within(browserElement).getByTestId('icon-close')).toBeInTheDocument();
    }
  });
};

describe('Performance > VitalDetail', function () {
  beforeEach(function () {
    TeamStore.loadInitialData([], false, null);
    ProjectsStore.loadInitialData(org.projects);
    browserHistory.push = jest.fn();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/user.email/values/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-vitals/`,
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
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            'count()': 'integer',
            'p95(measurements.lcp)': 'duration',
            transaction: 'string',
            'p50(measurements.lcp)': 'duration',
            project: 'string',
            'compare_numeric_aggregate(p75_measurements_lcp,greater,4000)': 'number',
            'project.id': 'integer',
            'count_unique_user()': 'integer',
            'p75(measurements.lcp)': 'duration',
          },
        },
        data: [
          {
            'count()': 100000,
            'p95(measurements.lcp)': 5000,
            transaction: 'something',
            'p50(measurements.lcp)': 3500,
            project: 'javascript',
            'compare_numeric_aggregate(p75_measurements_lcp,greater,4000)': 1,
            'count_unique_user()': 10000,
            'p75(measurements.lcp)': 4500,
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
      url: `/organizations/${organization.slug}/events/`,
      body: {
        meta: {
          fields: {
            'compare_numeric_aggregate(p75_measurements_cls,greater,0.1)': 'number',
            'compare_numeric_aggregate(p75_measurements_cls,greater,0.25)': 'number',
            'count()': 'integer',
            'count_unique_user()': 'integer',
            team_key_transaction: 'boolean',
            'p50(measurements.cls)': 'number',
            'p75(measurements.cls)': 'number',
            'p95(measurements.cls)': 'number',
            project: 'string',
            transaction: 'string',
          },
        },
        data: [
          {
            'compare_numeric_aggregate(p75_measurements_cls,greater,0.1)': 1,
            'compare_numeric_aggregate(p75_measurements_cls,greater,0.25)': 0,
            'count()': 10000,
            'count_unique_user()': 2740,
            team_key_transaction: 1,
            'p50(measurements.cls)': 0.143,
            'p75(measurements.cls)': 0.215,
            'p95(measurements.cls)': 0.302,
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
      url: `/organizations/${organization.slug}/key-transactions-list/`,
      body: [],
    });

    // Metrics Requests
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/metrics/tags/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/metrics/data/`,
      body: TestStubs.MetricsField({
        field: 'p75(sentry.transactions.measurements.lcp)',
      }),
      match: [
        MockApiClient.matchQuery({
          field: ['p75(sentry.transactions.measurements.lcp)'],
        }),
      ],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders basic UI elements', async function () {
    render(<TestComponent />, {
      context: routerContext,
      organization: org,
    });

    // It shows a search bar
    expect(await screen.findByLabelText('Search events')).toBeInTheDocument();

    // It shows the vital card
    expect(
      screen.getByText(textWithMarkupMatcher('The p75 for all transactions is 4500ms'))
    ).toBeInTheDocument();

    expect(screen.getByText('Good 50%', {exact: false})).toBeInTheDocument();
    expect(screen.getByText('Meh 33%', {exact: false})).toBeInTheDocument();
    expect(screen.getByText('Poor 17%', {exact: false})).toBeInTheDocument();

    // It shows a chart
    expect(screen.getByText('Duration p75')).toBeInTheDocument();

    // It shows a table
    expect(screen.getByText('something').closest('td')).toBeInTheDocument();
  });

  it('triggers a navigation on search', async function () {
    render(<TestComponent />, {
      context: routerContext,
      organization: org,
    });

    // Fill out the search box, and submit it.
    await userEvent.click(await screen.findByLabelText('Search events'));
    await userEvent.paste('user.email:uhoh*');
    await userEvent.keyboard('{enter}');

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

  it('applies conditions when linking to transaction summary', async function () {
    const newRouter = {
      ...router,
      location: {
        ...router.location,
        query: {
          query: 'sometag:value',
        },
      },
    };

    const context = TestStubs.routerContext([
      {
        organization,
        project,
        router: newRouter,
        location: newRouter.location,
      },
    ]);

    render(<TestComponent router={newRouter} />, {
      context,
      organization: org,
    });

    expect(
      await screen.findByRole('heading', {name: 'Largest Contentful Paint'})
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByLabelText('See transaction summary of the transaction something')
    );

    expect(newRouter.push).toHaveBeenCalledWith({
      pathname: `/organizations/${organization.slug}/performance/summary/`,
      query: {
        transaction: 'something',
        project: undefined,
        environment: [],
        statsPeriod: DEFAULT_STATS_PERIOD,
        start: undefined,
        end: undefined,
        query: 'sometag:value has:measurements.lcp',
        referrer: 'performance-transaction-summary',
        unselectedSeries: 'p100()',
        showTransactions: 'recent',
        display: 'vitals',
        trendFunction: undefined,
        trendColumn: undefined,
      },
    });
  });

  it('check CLS', async function () {
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

    const context = TestStubs.routerContext([
      {
        organization,
        project,
        router: newRouter,
        location: newRouter.location,
      },
    ]);

    render(<TestComponent router={newRouter} />, {
      context,
      organization: org,
    });

    expect(await screen.findByText('Cumulative Layout Shift')).toBeInTheDocument();

    await userEvent.click(
      screen.getByLabelText('See transaction summary of the transaction something')
    );

    expect(newRouter.push).toHaveBeenCalledWith({
      pathname: `/organizations/${organization.slug}/performance/summary/`,
      query: {
        transaction: 'something',
        project: undefined,
        environment: [],
        statsPeriod: DEFAULT_STATS_PERIOD,
        start: undefined,
        end: undefined,
        query: 'anothertag:value has:measurements.cls',
        referrer: 'performance-transaction-summary',
        unselectedSeries: 'p100()',
        showTransactions: 'recent',
        display: 'vitals',
        trendFunction: undefined,
        trendColumn: undefined,
      },
    });

    // Check cells are not in ms
    expect(screen.getByText('0.215').closest('td')).toBeInTheDocument();
  });

  it('can switch vitals with dropdown menu', async function () {
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

    const context = TestStubs.routerContext([
      {
        organization,
        project,
        router: newRouter,
        location: newRouter.location,
      },
    ]);

    render(<TestComponent router={newRouter} />, {
      context,
      organization: org,
    });

    const button = screen.getByRole('button', {name: /web vitals: lcp/i});
    expect(button).toBeInTheDocument();
    await userEvent.click(button);

    const menuItem = screen.getByRole('menuitemradio', {name: /fcp/i});
    expect(menuItem).toBeInTheDocument();
    await userEvent.click(menuItem);

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

  it('renders LCP vital correctly', async function () {
    render(<TestComponent />, {
      context: routerContext,
      organization: org,
    });

    expect(await screen.findByText('Largest Contentful Paint')).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('The p75 for all transactions is 4500ms'))
    ).toBeInTheDocument();

    expect(screen.getByText('4.50s').closest('td')).toBeInTheDocument();
  });

  it('correctly renders which browsers support LCP', function () {
    render(<TestComponent />, {
      context: routerContext,
      organization: org,
    });

    testSupportedBrowserRendering(WebVital.LCP);
  });

  it('correctly renders which browsers support CLS', function () {
    const newRouter = {
      ...router,
      location: {
        ...router.location,
        query: {
          vitalName: 'measurements.cls',
        },
      },
    };

    render(<TestComponent router={newRouter} />, {
      context: routerContext,
      organization: org,
    });

    testSupportedBrowserRendering(WebVital.CLS);
  });

  it('correctly renders which browsers support FCP', function () {
    const newRouter = {
      ...router,
      location: {
        ...router.location,
        query: {
          vitalName: 'measurements.fcp',
        },
      },
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: [],
    });

    render(<TestComponent router={newRouter} />, {
      context: routerContext,
      organization: org,
    });

    testSupportedBrowserRendering(WebVital.FCP);
  });

  it('correctly renders which browsers support FID', function () {
    const newRouter = {
      ...router,
      location: {
        ...router.location,
        query: {
          vitalName: 'measurements.fid',
        },
      },
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: [],
    });

    render(<TestComponent router={newRouter} />, {
      context: routerContext,
      organization: org,
    });

    testSupportedBrowserRendering(WebVital.FID);
  });
});
