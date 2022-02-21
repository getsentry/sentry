import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {Project} from 'sentry/types';
import {TransactionMetric} from 'sentry/utils/metrics/fields';
import {MetricsSwitchContext} from 'sentry/views/performance/metricsSwitch';
import TransactionSummary from 'sentry/views/performance/transactionSummary/transactionOverview';

const teams = [
  TestStubs.Team({id: '1', slug: 'team1', name: 'Team 1'}),
  TestStubs.Team({id: '2', slug: 'team2', name: 'Team 2'}),
];

function initializeData({
  features: additionalFeatures = [],
  query = {},
  project: prj,
}: {features?: string[]; project?: Project; query?: Record<string, any>} = {}) {
  const features = ['discover-basic', 'performance-view', ...additionalFeatures];
  const project = prj ?? TestStubs.Project({teams});
  const organization = TestStubs.Organization({
    features,
    projects: [project],
    apdexThreshold: 400,
  });
  const initialData = initializeOrg({
    ...initializeOrg(),
    organization,
    router: {
      location: {
        query: {
          transaction: '/performance',
          project: project.id,
          transactionCursor: '1:0:0',
          ...query,
        },
      },
    },
  });

  ProjectsStore.loadInitialData(initialData.organization.projects);
  TeamStore.loadInitialData(teams, false, null);

  return initialData;
}

const TestComponent = ({
  isMetricsData = false,
  ...props
}: React.ComponentProps<typeof TransactionSummary> & {
  isMetricsData?: boolean;
}) => {
  return (
    <MetricsSwitchContext.Provider value={{isMetricsData, setIsMetricsData: jest.fn()}}>
      <TransactionSummary {...props} />
    </MetricsSwitchContext.Provider>
  );
};

describe('Performance > TransactionSummary', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/user.email/values/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&project=2&query=is%3Aunresolved%20transaction%3A%2Fperformance&sort=new&statsPeriod=14d',
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
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets-performance/',
      body: {},
    });

    // Mock totals for the sidebar and other summary data
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          count: 'number',
          apdex: 'number',
          count_miserable_user: 'number',
          user_misery: 'number',
          count_unique_user: 'number',
          p95: 'number',
          failure_rate: 'number',
          tpm: 'number',
          project_threshold_config: 'string',
        },
        data: [
          {
            count: 2,
            apdex: 0.6,
            count_miserable_user: 122,
            user_misery: 0.114,
            count_unique_user: 1,
            p95: 750.123,
            failure_rate: 1,
            tpm: 1,
            project_threshold_config: ['duration', 300],
          },
        ],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('p95()');
        },
      ],
    });
    // Transaction list response
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      headers: {
        Link:
          '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",' +
          '<http://localhost/api/0/organizations/org-slug/eventsv2/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"',
      },
      body: {
        meta: {
          id: 'string',
          'user.display': 'string',
          'transaction.duration': 'duration',
          'project.id': 'integer',
          timestamp: 'date',
        },
        data: [
          {
            id: 'deadbeef',
            'user.display': 'uhoh@example.com',
            'transaction.duration': 400,
            'project.id': 2,
            timestamp: '2020-05-21T15:31:18+00:00',
          },
        ],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('user.display');
        },
      ],
    });
    // Mock totals for status breakdown
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          'transaction.status': 'string',
          count: 'number',
        },
        data: [
          {
            count: 2,
            'transaction.status': 'ok',
          },
        ],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.includes('transaction.status');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets/',
      body: [
        {
          key: 'release',
          topValues: [{count: 3, value: 'abcd123', name: 'abcd123'}],
        },
        {
          key: 'environment',
          topValues: [{count: 2, value: 'dev', name: 'dev'}],
        },
        {
          key: 'foo',
          topValues: [{count: 1, value: 'bar', name: 'bar'}],
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {
        threshold: '800',
        metric: 'lcp',
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-vitals/',
      body: {
        'measurements.fcp': {
          poor: 3,
          meh: 100,
          good: 47,
          total: 150,
          p75: 1500,
        },
        'measurements.lcp': {
          poor: 2,
          meh: 38,
          good: 40,
          total: 80,
          p75: 2750,
        },
        'measurements.fid': {
          poor: 2,
          meh: 53,
          good: 5,
          total: 60,
          p75: 1000,
        },
        'measurements.cls': {
          poor: 3,
          meh: 10,
          good: 4,
          total: 17,
          p75: 0.2,
        },
      },
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: teams.map(({id}) => ({
        team: id,
        count: 0,
        keyed: [],
      })),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    jest.clearAllMocks();
  });

  it('renders basic UI elements', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    //  It shows the header
    await screen.findByText('Transaction Summary');
    expect(screen.getByRole('heading', {name: '/performance'})).toBeInTheDocument();

    // It shows a chart
    expect(screen.getByRole('button', {name: 'Duration Breakdown'})).toBeInTheDocument();

    // It shows a searchbar
    expect(screen.getByLabelText('Search events')).toBeInTheDocument();

    // It shows a table
    expect(screen.getByTestId('transactions-table')).toBeInTheDocument();

    // Ensure open in discover button exists.
    expect(screen.getByTestId('transaction-events-open')).toBeInTheDocument();

    // Ensure open issues button exists.
    expect(screen.getByRole('button', {name: 'Open in Issues'})).toBeInTheDocument();

    // Ensure transaction filter button exists
    expect(screen.getByText('Filter').closest('button')).toBeInTheDocument();

    // Ensure create alert from discover is hidden without metric alert
    expect(screen.queryByRole('button', {name: 'Create Alert'})).not.toBeInTheDocument();

    // Ensure status breakdown exists
    expect(screen.getByText('Status Breakdown')).toBeInTheDocument();
  });

  it('renders feature flagged UI elements', function () {
    const {organization, router, routerContext} = initializeData({
      features: ['incidents'],
    });

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    // Ensure create alert from discover is shown with metric alerts
    expect(screen.getByRole('button', {name: 'Create Alert'})).toBeInTheDocument();
  });

  it('renders Web Vitals widget', async function () {
    const {organization, router, routerContext} = initializeData({
      project: TestStubs.Project({teams, platform: 'javascript'}),
      query: {
        query:
          'transaction.duration:<15m transaction.op:pageload event.type:transaction transaction:/organizations/:orgId/issues/',
      },
    });

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    // It renders the web vitals widget
    await screen.findByRole('heading', {name: 'Web Vitals'});

    const vitalStatues = screen.getAllByTestId('vital-status');
    expect(vitalStatues).toHaveLength(3);

    expect(vitalStatues[0]).toHaveTextContent('31%');
    expect(vitalStatues[1]).toHaveTextContent('65%');
    expect(vitalStatues[2]).toHaveTextContent('3%');
  });

  it('renders Web Vitals widget - metrics based', async function () {
    const fields = [
      `count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FCP})`,
      `count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_LCP})`,
      `count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_FID})`,
      `count(${TransactionMetric.SENTRY_TRANSACTIONS_MEASUREMENTS_CLS})`,
    ];

    const field = `count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`;

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/tags/`,
      body: [],
    });

    const metricsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldsByMeasurementRating({fields}),
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldByTransactionStatus({field}),
      match: [MockApiClient.matchQuery({groupBy: ['transaction.status']})],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsField({field}),
      match: [MockApiClient.matchQuery({groupBy: undefined})],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: null,
      match: [
        MockApiClient.matchQuery({
          groupBy: undefined,
          field: [
            'p50(sentry.transactions.transaction.duration)',
            'p75(sentry.transactions.transaction.duration)',
            'p95(sentry.transactions.transaction.duration)',
            'p99(sentry.transactions.transaction.duration)',
            'max(sentry.transactions.transaction.duration)',
          ],
        }),
      ],
    });

    const {organization, router, routerContext} = initializeData({
      project: TestStubs.Project({teams, platform: 'javascript'}),
      query: {
        query: 'transaction:/organizations/:orgId/issues/',
      },
    });

    mountWithTheme(<TestComponent location={router.location} isMetricsData />, {
      context: routerContext,
      organization,
    });

    // It renders the web vitals widget
    await screen.findByRole('heading', {name: 'Web Vitals'});

    expect(metricsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          project: [2],
          environment: [],
          field: [
            'count(sentry.transactions.measurements.fcp)',
            'count(sentry.transactions.measurements.lcp)',
            'count(sentry.transactions.measurements.fid)',
            'count(sentry.transactions.measurements.cls)',
          ],
          query: 'transaction:/organizations/:orgId/issues/',
          groupBy: ['measurement_rating'],
          interval: '1h',
          statsPeriod: '14d',
        }),
      })
    );

    const vitalStatues = screen.getAllByTestId('vital-status');
    expect(vitalStatues).toHaveLength(3);

    expect(vitalStatues[0]).toHaveTextContent('78%');
    expect(vitalStatues[1]).toHaveTextContent('6%');
    expect(vitalStatues[2]).toHaveTextContent('17%');
  });

  it('renders sidebar widgets', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    // Renders Apdex widget
    await screen.findByRole('heading', {name: 'Apdex'});
    expect(screen.getByTestId('apdex-summary-value')).toHaveTextContent('0.6');

    // Renders Failure Rate widget
    expect(screen.getByRole('heading', {name: 'Failure Rate'})).toBeInTheDocument();
    expect(screen.getByTestId('failure-rate-summary-value')).toHaveTextContent('100%');

    // Renders TPM widget
    expect(screen.getByRole('heading', {name: 'TPM'})).toBeInTheDocument();
    expect(screen.getByTestId('tpm-summary-value')).toHaveTextContent('1 tpm');
  });

  it('renders sidebar widgets - metrics based', async function () {
    const field = `count(${TransactionMetric.SENTRY_TRANSACTIONS_TRANSACTION_DURATION})`;

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/tags/`,
      body: [],
    });

    const failureRateRequestMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsFieldByTransactionStatus({field}),
      match: [MockApiClient.matchQuery({groupBy: ['transaction.status']})],
    });

    const tpmRequestMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: TestStubs.MetricsField({field}),
      match: [MockApiClient.matchQuery({groupBy: undefined})],
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics/data/`,
      body: null,
      match: [
        MockApiClient.matchQuery({
          groupBy: undefined,
          field: [
            'p50(sentry.transactions.transaction.duration)',
            'p75(sentry.transactions.transaction.duration)',
            'p95(sentry.transactions.transaction.duration)',
            'p99(sentry.transactions.transaction.duration)',
            'max(sentry.transactions.transaction.duration)',
          ],
        }),
      ],
    });

    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TestComponent location={router.location} isMetricsData />, {
      context: routerContext,
      organization,
    });

    // Renders Apdex widget
    await screen.findByRole('heading', {name: 'Apdex'});
    expect(screen.queryByTestId('apdex-summary-value')).not.toBeInTheDocument();

    // Renders Failure Rate widget
    expect(screen.getByRole('heading', {name: 'Failure Rate'})).toBeInTheDocument();
    expect(failureRateRequestMock).toHaveBeenCalledWith(
      '/organizations/org-slug/metrics/data/',
      expect.objectContaining({
        query: {
          environment: [],
          field: ['count(sentry.transactions.transaction.duration)'],
          groupBy: ['transaction.status'],
          interval: '1h',
          project: [2],
          query: 'transaction:/performance',
          statsPeriod: '14d',
        },
      })
    );

    expect(screen.getByTestId('failure-rate-summary-value')).toHaveTextContent('39.16%');

    // Renders TPM widget
    expect(screen.getByRole('heading', {name: 'TPM'})).toBeInTheDocument();

    expect(tpmRequestMock).toHaveBeenCalledWith(
      '/organizations/org-slug/metrics/data/',
      expect.objectContaining({
        query: {
          environment: [],
          field: ['count(sentry.transactions.transaction.duration)'],
          interval: '1h',
          project: [2],
          query: 'transaction:/performance',
          statsPeriod: '14d',
        },
      })
    );

    expect(screen.getByTestId('tpm-summary-value')).toHaveTextContent('534.3016 tpm');
  });

  it('fetches transaction threshold', function () {
    const {organization, router, routerContext} = initializeData();

    const getTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      body: {
        threshold: '800',
        metric: 'lcp',
      },
    });

    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        threshold: '200',
        metric: 'duration',
      },
    });

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
    expect(getProjectThresholdMock).not.toHaveBeenCalled();
  });

  it('fetches project transaction threshdold', async function () {
    const {organization, router, routerContext} = initializeData();

    const getTransactionThresholdMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/project-transaction-threshold-override/',
      method: 'GET',
      statusCode: 404,
    });

    const getProjectThresholdMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/transaction-threshold/configure/',
      method: 'GET',
      body: {
        threshold: '200',
        metric: 'duration',
      },
    });

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    await screen.findByText('Transaction Summary');

    expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
    expect(getProjectThresholdMock).toHaveBeenCalledTimes(1);
  });

  it('triggers a navigation on search', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    // Fill out the search box, and submit it.
    userEvent.type(screen.getByLabelText('Search events'), 'user.email:uhoh*{enter}');

    // Check the navigation.
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        transaction: '/performance',
        project: '2',
        statsPeriod: '14d',
        query: 'user.email:uhoh*',
        transactionCursor: '1:0:0',
      },
    });
  });

  it('can mark a transaction as key', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    const mockUpdate = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/key-transactions/`,
      method: 'POST',
      body: {},
    });

    await screen.findByRole('button', {name: 'Star for Team'});

    // Click the key transaction button
    userEvent.click(screen.getByRole('button', {name: 'Star for Team'}));

    userEvent.click(screen.getByText('team1'));

    // Ensure request was made.
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('triggers a navigation on transaction filter', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    await screen.findByText('Transaction Summary');

    // Open the transaction filter dropdown
    userEvent.click(screen.getByRole('button', {name: 'Filter Slow Transactions (p95)'}));

    userEvent.click(screen.getByRole('button', {name: 'Slow Transactions (p95)'}));

    // Check the navigation.
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        transaction: '/performance',
        project: '2',
        showTransactions: 'slow',
        transactionCursor: undefined,
      },
    });
  });

  it('renders pagination buttons', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    await screen.findByText('Transaction Summary');

    expect(screen.getByLabelText('Previous')).toBeInTheDocument();

    // Click the 'next' button
    userEvent.click(screen.getByLabelText('Next'));

    // Check the navigation.
    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        transaction: '/performance',
        project: '2',
        transactionCursor: '2:0:0',
      },
    });
  });

  it('forwards conditions to related issues', async function () {
    const issueGet = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&project=2&query=tag%3Avalue%20is%3Aunresolved%20transaction%3A%2Fperformance&sort=new&statsPeriod=14d',
      body: [],
    });

    const {organization, router, routerContext} = initializeData({
      query: {query: 'tag:value'},
    });

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    await screen.findByText('Transaction Summary');

    expect(issueGet).toHaveBeenCalled();
  });

  it('does not forward event type to related issues', async function () {
    const issueGet = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&project=2&query=tag%3Avalue%20is%3Aunresolved%20transaction%3A%2Fperformance&sort=new&statsPeriod=14d',
      body: [],
      match: [
        (_, options) => {
          // event.type must NOT be in the query params
          return !options.query?.query?.includes('event.type');
        },
      ],
    });

    const {organization, router, routerContext} = initializeData({
      query: {query: 'tag:value event.type:transaction'},
    });

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    await screen.findByText('Transaction Summary');

    expect(issueGet).toHaveBeenCalled();
  });

  it('renders the suspect spans table if the feature is enabled', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-spans-performance/',
      body: [],
    });

    const {organization, router, routerContext} = initializeData({
      features: ['performance-suspect-spans-view'],
    });

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    expect(await screen.findByText('Suspect Spans')).toBeInTheDocument();
  });

  it('adds search condition on transaction status when clicking on status breakdown', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    await screen.findByTestId('status-ok');

    userEvent.click(screen.getByTestId('status-ok'));

    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          query: expect.stringContaining('transaction.status:ok'),
        }),
      })
    );
  });

  it('appends tag value to existing query when clicked', async function () {
    const {organization, router, routerContext} = initializeData();

    mountWithTheme(<TestComponent location={router.location} />, {
      context: routerContext,
      organization,
    });

    await screen.findByText('Tag Summary');

    userEvent.click(screen.getByLabelText('Add the dev segment tag to the search query'));
    userEvent.click(screen.getByLabelText('Add the bar segment tag to the search query'));

    expect(router.push).toHaveBeenCalledTimes(2);

    expect(router.push).toHaveBeenNthCalledWith(1, {
      query: {
        project: '2',
        query: 'tags[environment]:dev',
        transaction: '/performance',
        transactionCursor: '1:0:0',
      },
    });

    expect(router.push).toHaveBeenNthCalledWith(2, {
      query: {
        project: '2',
        query: 'foo:bar',
        transaction: '/performance',
        transactionCursor: '1:0:0',
      },
    });
  });
});
