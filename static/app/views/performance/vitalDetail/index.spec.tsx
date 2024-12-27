import {MetricsFieldFixture} from 'sentry-fixture/metrics';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {browserHistory} from 'sentry/utils/browserHistory';
import {WebVital} from 'sentry/utils/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';
import {DEFAULT_STATS_PERIOD} from 'sentry/views/performance/data';
import VitalDetail from 'sentry/views/performance/vitalDetail';
import {vitalSupportedBrowsers} from 'sentry/views/performance/vitalDetail/utils';

const api = new MockApiClient();
const organization = OrganizationFixture({
  features: ['discover-basic', 'performance-view'],
});

const {
  organization: org,
  project,
  router,
} = initializeOrg({
  organization,
  router: {
    location: {
      query: {
        project: '1',
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
    ProjectsStore.loadInitialData([project]);
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
      body: MetricsFieldFixture('p75(sentry.transactions.measurements.lcp)'),
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
      router,
      organization: org,
    });

    // It shows a search bar
    expect(
      await screen.findByPlaceholderText('Search for events, users, tags, and more')
    ).toBeInTheDocument();

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
      router,
      organization: org,
    });

    // Fill out the search box, and submit it.
    await userEvent.click(
      await screen.findByPlaceholderText('Search for events, users, tags, and more')
    );
    await userEvent.paste('user.email:uhoh*');
    await userEvent.keyboard('{enter}');

    // Check the navigation.
    await waitFor(() => {
      expect(browserHistory.push).toHaveBeenCalledTimes(1);
    });

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        project: '1',
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

    render(<TestComponent router={newRouter} />, {
      router: newRouter,
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
        environment: undefined,
        statsPeriod: DEFAULT_STATS_PERIOD,
        start: undefined,
        end: undefined,
        query: 'sometag:value has:measurements.lcp',
        referrer: 'performance-transaction-summary',
        unselectedSeries: ['p100()', 'avg()'],
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

    render(<TestComponent router={newRouter} />, {
      router: newRouter,
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
        environment: undefined,
        statsPeriod: DEFAULT_STATS_PERIOD,
        start: undefined,
        end: undefined,
        query: 'anothertag:value has:measurements.cls',
        referrer: 'performance-transaction-summary',
        unselectedSeries: ['p100()', 'avg()'],
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

    render(<TestComponent router={newRouter} />, {
      router: newRouter,
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
      router,
      organization: org,
    });

    expect(await screen.findByText('Largest Contentful Paint')).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher('The p75 for all transactions is 4500ms'))
    ).toBeInTheDocument();

    expect(screen.getByText('4.50s').closest('td')).toBeInTheDocument();
  });

  it('correctly renders which browsers support LCP', async function () {
    render(<TestComponent />, {
      router,
      organization: org,
    });

    expect(await screen.findAllByText(/Largest Contentful Paint/)).toHaveLength(2);
    testSupportedBrowserRendering(WebVital.LCP);
  });

  it('correctly renders which browsers support CLS', async function () {
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
      router,
      organization: org,
    });

    expect(await screen.findAllByText(/Cumulative Layout Shift/)).toHaveLength(2);
    testSupportedBrowserRendering(WebVital.CLS);
  });

  it('correctly renders which browsers support FCP', async function () {
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
      router,
      organization: org,
    });

    expect(await screen.findAllByText(/First Contentful Paint/)).toHaveLength(2);
    testSupportedBrowserRendering(WebVital.FCP);
  });

  it('correctly renders which browsers support FID', async function () {
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
      router,
      organization: org,
    });

    expect(await screen.findAllByText(/First Input Delay/)).toHaveLength(2);
    testSupportedBrowserRendering(WebVital.FID);
  });
});
