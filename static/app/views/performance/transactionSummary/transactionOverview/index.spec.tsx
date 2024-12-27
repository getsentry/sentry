import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  findByLabelText,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Project} from 'sentry/types/project';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {
  MEPSetting,
  MEPState,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import TransactionSummary from 'sentry/views/performance/transactionSummary/transactionOverview';

const teams = [
  TeamFixture({id: '1', slug: 'team1', name: 'Team 1'}),
  TeamFixture({id: '2', slug: 'team2', name: 'Team 2'}),
];

function initializeData({
  features: additionalFeatures = [],
  query = {},
  project: prj,
  projects,
}: {
  features?: string[];
  project?: Project;
  projects?: Project[];
  query?: Record<string, any>;
} = {}) {
  const features = ['discover-basic', 'performance-view', ...additionalFeatures];
  const project = prj ?? ProjectFixture({teams});
  const organization = OrganizationFixture({
    features,
  });
  const initialData = initializeOrg({
    organization,
    projects: projects ? projects : [project],
    router: {
      location: {
        pathname: '/',
        query: {
          transaction: '/performance',
          project: project.id,
          transactionCursor: '1:0:0',
          ...query,
        },
      },
    },
  });

  ProjectsStore.loadInitialData(initialData.projects);
  TeamStore.loadInitialData(teams, false, null);

  return initialData;
}

function TestComponent({
  ...props
}: React.ComponentProps<typeof TransactionSummary> & {
  router: InjectedRouter<Record<string, string>, any>;
}) {
  if (!props.organization) {
    throw new Error('Missing organization');
  }

  return (
    <MetricsCardinalityProvider
      organization={props.organization}
      location={props.location}
    >
      <TransactionSummary {...props} />
    </MetricsCardinalityProvider>
  );
}

describe('Performance > TransactionSummary', function () {
  let eventStatsMock: jest.Mock;
  beforeEach(function () {
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());

    // Small screen size will hide search bar trailing items like warning icon
    Object.defineProperty(Element.prototype, 'clientWidth', {value: 1000});

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
    eventStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&project=2&query=is%3Aunresolved%20transaction%3A%2Fperformance&sort=trends&statsPeriod=14d',
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
      url: '/organizations/org-slug/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-facets-performance/',
      body: {},
    });
    // Events Mock totals for the sidebar and other summary data
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {
          fields: {
            'count()': 'number',
            'apdex()': 'number',
            'count_miserable_user()': 'number',
            'user_misery()': 'number',
            'count_unique_user()': 'number',
            'p95()': 'number',
            'failure_rate()': 'number',
            'tpm()': 'number',
            project_threshold_config: 'string',
          },
        },
        data: [
          {
            'count()': 2,
            'apdex()': 0.6,
            'count_miserable_user()': 122,
            'user_misery()': 0.114,
            'count_unique_user()': 1,
            'p95()': 750.123,
            'failure_rate()': 1,
            'tpm()': 1,
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
    // [Metrics Enhanced] Events Mock totals for the sidebar and other summary data
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {
          fields: {
            'count()': 'number',
            'apdex()': 'number',
            'count_miserable_user()': 'number',
            'user_misery()': 'number',
            'count_unique_user()': 'number',
            'p95()': 'number',
            'failure_rate()': 'number',
            'tpm()': 'number',
            project_threshold_config: 'string',
          },
          isMetricsData: true,
        },
        data: [
          {
            'count()': 200,
            'apdex()': 0.5,
            'count_miserable_user()': 120,
            'user_misery()': 0.1,
            'count_unique_user()': 100,
            'p95()': 731.3132,
            'failure_rate()': 1,
            'tpm()': 100,
            project_threshold_config: ['duration', 300],
          },
        ],
      },
      match: [
        (_url, options) => {
          const isMetricsEnhanced =
            options.query?.dataset === DiscoverDatasets.METRICS_ENHANCED;
          return options.query?.field?.includes('p95()') && isMetricsEnhanced;
        },
      ],
    });
    // Events Mock unfiltered totals for percentage calculations
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {
          fields: {
            'tpm()': 'number',
          },
        },
        data: [
          {
            'tpm()': 1,
          },
        ],
      },
      match: [
        (_url, options) => {
          return (
            options.query?.field?.includes('tpm()') &&
            !options.query?.field?.includes('p95()')
          );
        },
      ],
    });
    // Events Mock count totals for histogram percentage calculations
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {
          fields: {
            'count()': 'number',
          },
        },
        data: [
          {
            'count()': 2,
          },
        ],
      },
      match: [
        (_url, options) => {
          return (
            options.query?.field?.length === 1 && options.query?.field[0] === 'count()'
          );
        },
      ],
    });
    // Events Transaction list response
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      headers: {
        Link:
          '<http://localhost/api/0/organizations/org-slug/events/?cursor=2:0:0>; rel="next"; results="true"; cursor="2:0:0",' +
          '<http://localhost/api/0/organizations/org-slug/events/?cursor=1:0:0>; rel="previous"; results="false"; cursor="1:0:0"',
      },
      body: {
        meta: {
          fields: {
            id: 'string',
            'user.display': 'string',
            'transaction.duration': 'duration',
            'project.id': 'integer',
            timestamp: 'date',
          },
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
    // Events Mock totals for status breakdown
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {
          fields: {
            'transaction.status': 'string',
            'count()': 'number',
          },
        },
        data: [
          {
            'count()': 2,
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
          topValues: [
            {count: 2, value: 'dev', name: 'dev'},
            {count: 1, value: 'prod', name: 'prod'},
          ],
        },
        {
          key: 'foo',
          topValues: [
            {count: 2, value: 'bar', name: 'bar'},
            {count: 1, value: 'baz', name: 'baz'},
          ],
        },
        {
          key: 'user',
          topValues: [
            {count: 2, value: 'id:100', name: '100'},
            {count: 1, value: 'id:101', name: '101'},
          ],
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-spans-performance/',
      body: [
        {
          op: 'ui.long-task',
          group: 'c777169faad84eb4',
          description: 'Main UI thread blocked',
          frequency: 713,
          count: 9040,
          avgOccurrences: null,
          sumExclusiveTime: 1743893.9822921753,
          p50ExclusiveTime: null,
          p75ExclusiveTime: 244.9998779296875,
          p95ExclusiveTime: null,
          p99ExclusiveTime: null,
        },
      ],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics-compatibility/`,
      body: {
        compatible_projects: [],
        incompatible_projecs: [],
      },
    });

    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/metrics-compatibility-sums/`,
      body: {
        sum: {
          metrics: 100,
          metrics_null: 0,
          metrics_unparam: 0,
        },
      },
    });

    // Events Mock slowest functions
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {
          fields: {
            function: 'string',
            package: 'string',
            'p75()': 'duration',
            'count()': 'integer',
            'sum()': 'duration',
            'all_examples()': 'string',
          },
        },
        data: [],
      },
      match: [
        (_url, options) => {
          return options.query?.field?.indexOf('all_examples()') !== -1;
        },
      ],
    });

    // Flamegraph mock
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/profiling/flamegraph/',
      body: {
        activeProfileIndex: 0,
        metadata: {
          deviceClassification: '',
          deviceLocale: '',
          deviceManufacturer: '',
          deviceModel: '',
          deviceOSName: '',
          deviceOSVersion: '',
          durationNS: 0,
          organizationID: 0,
          platform: '',
          profileID: '',
          projectID: 0,
          received: '0001-01-01T00:00:00Z',
          sampled: false,
          timestamp: '0001-01-01T00:00:00Z',
          traceID: '',
          transactionID: '',
          transactionName: '',
          version: '',
        },
        platform: '',
        profiles: [
          {
            endValue: 0,
            isMainThread: true,
            name: '',
            samples: [],
            startValue: 0,
            threadID: 0,
            type: 'sampled',
            unit: 'count',
            weights: [],
            sample_durations_ns: null,
          },
        ],
        projectID: 0,
        shared: {
          frames: [],
        },
        transactionName: '',
        metrics: [],
      },
    });

    jest.spyOn(MEPSetting, 'get').mockImplementation(() => MEPState.AUTO);
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
    jest.clearAllMocks();

    // Cleanup clientWidth mock
    // @ts-expect-error
    delete HTMLElement.prototype.clientWidth;
  });

  describe('with events', function () {
    it('renders basic UI elements', async function () {
      const {organization, router} = initializeData();

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      //  It shows the header
      await screen.findByText('Transaction Summary');
      expect(screen.getByText('/performance')).toBeInTheDocument();

      // It shows a chart
      expect(
        screen.getByRole('button', {name: 'Display Duration Breakdown'})
      ).toBeInTheDocument();

      // It shows a searchbar
      expect(
        screen.getByPlaceholderText('Search for events, users, tags, and more')
      ).toBeInTheDocument();

      // It shows a table
      expect(screen.getByTestId('transactions-table')).toBeInTheDocument();

      // Ensure open in discover button exists.
      expect(screen.getByTestId('transaction-events-open')).toBeInTheDocument();

      // Ensure open issues button exists.
      expect(screen.getByRole('button', {name: 'Open in Issues'})).toBeInTheDocument();

      // Ensure transaction filter button exists
      expect(
        screen.getByRole('button', {name: 'Filter Slow Transactions (p95)'})
      ).toBeInTheDocument();

      // Ensure create alert from discover is hidden without metric alert
      expect(
        screen.queryByRole('button', {name: 'Create Alert'})
      ).not.toBeInTheDocument();

      // Ensure status breakdown exists
      expect(screen.getByText('Status Breakdown')).toBeInTheDocument();
    });

    it('renders feature flagged UI elements', function () {
      const {organization, router} = initializeData({
        features: ['incidents'],
      });

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      // Ensure create alert from discover is shown with metric alerts
      expect(screen.getByRole('button', {name: 'Create Alert'})).toBeInTheDocument();
    });

    it('renders Web Vitals widget', async function () {
      const {organization, router} = initializeData({
        project: ProjectFixture({teams, platform: 'javascript'}),
        query: {
          query:
            'transaction.duration:<15m transaction.op:pageload event.type:transaction transaction:/organizations/:orgId/issues/',
        },
      });

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      // It renders the web vitals widget
      await screen.findByRole('heading', {name: 'Web Vitals'});

      await waitFor(() => {
        expect(screen.getAllByTestId('vital-status')).toHaveLength(3);
      });

      const vitalStatues = screen.getAllByTestId('vital-status');
      expect(vitalStatues[0]).toHaveTextContent('31%');
      expect(vitalStatues[1]).toHaveTextContent('65%');
      expect(vitalStatues[2]).toHaveTextContent('3%');
    });

    it('renders sidebar widgets', async function () {
      const {organization, router} = initializeData({});

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      // Renders Apdex widget
      await screen.findByRole('heading', {name: 'Apdex'});
      expect(await screen.findByTestId('apdex-summary-value')).toHaveTextContent('0.6');

      // Renders Failure Rate widget
      expect(screen.getByRole('heading', {name: 'Failure Rate'})).toBeInTheDocument();
      expect(screen.getByTestId('failure-rate-summary-value')).toHaveTextContent('100%');
    });

    it('renders project picker modal when no url does not have project id', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {
          meta: {
            fields: {
              project: 'string',
              'count()': 'number',
            },
          },
          data: [
            {
              'count()': 2,
              project: 'proj-slug-1',
            },
            {
              'count()': 3,
              project: 'proj-slug-2',
            },
          ],
        },
        match: [
          (_url, options) => {
            return options.query?.field?.includes('project');
          },
        ],
      });

      const projects = [
        ProjectFixture({
          slug: 'proj-slug-1',
          id: '1',
          name: 'Project Name 1',
        }),
        ProjectFixture({
          slug: 'proj-slug-2',
          id: '2',
          name: 'Project Name 2',
        }),
      ];
      OrganizationStore.onUpdate(OrganizationFixture({slug: 'org-slug'}), {
        replace: true,
      });
      const {organization, router} = initializeData({projects});
      const spy = jest.spyOn(router, 'replace');

      // Ensure project id is not in path
      delete router.location.query.project;

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {router, organization}
      );

      renderGlobalModal();

      const firstProjectOption = await screen.findByText('proj-slug-1');
      expect(firstProjectOption).toBeInTheDocument();
      expect(screen.getByText('proj-slug-2')).toBeInTheDocument();
      expect(screen.getByText('My Projects')).toBeInTheDocument();

      await userEvent.click(firstProjectOption);
      expect(spy).toHaveBeenCalledWith(
        '/organizations/org-slug/performance/summary/?transaction=/performance&statsPeriod=14d&referrer=performance-transaction-summary&transactionCursor=1:0:0&project=1'
      );
    });

    it('fetches transaction threshold', function () {
      const {organization, router} = initializeData();

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

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
      expect(getProjectThresholdMock).not.toHaveBeenCalled();
    });

    it('fetches project transaction threshdold', async function () {
      const {organization, router} = initializeData();

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

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Transaction Summary');

      expect(getTransactionThresholdMock).toHaveBeenCalledTimes(1);
      expect(getProjectThresholdMock).toHaveBeenCalledTimes(1);
    });

    it('triggers a navigation on search', async function () {
      const {organization, router} = initializeData();

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      // Fill out the search box, and submit it.
      await userEvent.click(
        screen.getByPlaceholderText('Search for events, users, tags, and more')
      );
      await userEvent.paste('user.email:uhoh*');
      await userEvent.keyboard('{enter}');

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledTimes(1);
      });

      // Check the navigation.
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/',
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
      const {organization, router} = initializeData();

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      const mockUpdate = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/key-transactions/`,
        method: 'POST',
        body: {},
      });

      await screen.findByRole('button', {name: 'Star for Team'});

      // Click the key transaction button
      await userEvent.click(screen.getByRole('button', {name: 'Star for Team'}));

      await userEvent.click(screen.getByRole('option', {name: '#team1'}));

      // Ensure request was made.
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('triggers a navigation on transaction filter', async function () {
      const {organization, router} = initializeData();

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Transaction Summary');
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });

      // Open the transaction filter dropdown
      await userEvent.click(
        screen.getByRole('button', {name: 'Filter Slow Transactions (p95)'})
      );

      await userEvent.click(screen.getAllByText('Slow Transactions (p95)')[1]);

      // Check the navigation.
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/',
        query: {
          transaction: '/performance',
          project: '2',
          showTransactions: 'slow',
          transactionCursor: undefined,
        },
      });
    });

    it('renders pagination buttons', async function () {
      const {organization, router} = initializeData();

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Transaction Summary');

      const pagination = await screen.findByTestId('pagination');
      expect(await findByLabelText(pagination, 'Previous')).toBeInTheDocument();
      expect(await findByLabelText(pagination, 'Next')).toBeInTheDocument();

      // Click the 'next' button
      await userEvent.click(await findByLabelText(pagination, 'Next'));

      // Check the navigation.
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/',
        query: {
          transaction: '/performance',
          project: '2',
          transactionCursor: '2:0:0',
        },
      });
    });

    it('forwards conditions to related issues', async function () {
      const issueGet = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/?limit=5&project=2&query=tag%3Avalue%20is%3Aunresolved%20transaction%3A%2Fperformance&sort=trends&statsPeriod=14d',
        body: [],
      });

      const {organization, router} = initializeData({
        query: {query: 'tag:value'},
      });

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Transaction Summary');

      expect(issueGet).toHaveBeenCalled();
    });

    it('does not forward event type to related issues', async function () {
      const issueGet = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/?limit=5&project=2&query=tag%3Avalue%20is%3Aunresolved%20transaction%3A%2Fperformance&sort=trends&statsPeriod=14d',
        body: [],
        match: [
          (_, options) => {
            // event.type must NOT be in the query params
            return !options.query?.query?.includes('event.type');
          },
        ],
      });

      const {organization, router} = initializeData({
        query: {query: 'tag:value event.type:transaction'},
      });

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Transaction Summary');

      expect(issueGet).toHaveBeenCalled();
    });

    it('renders the suspect spans table if the feature is enabled', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-spans-performance/',
        body: [],
      });

      const {organization, router} = initializeData();

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      expect(await screen.findByText('Suspect Spans')).toBeInTheDocument();
    });

    it('adds search condition on transaction status when clicking on status breakdown', async function () {
      const {organization, router} = initializeData();

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByTestId('status-ok');

      await userEvent.click(screen.getByTestId('status-ok'));

      expect(router.push).toHaveBeenCalledTimes(1);
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('transaction.status:ok'),
          }),
        })
      );
    });

    it('appends tag value to existing query when clicked', async function () {
      const {organization, router} = initializeData();

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Tag Summary');

      // Expand environment tag
      await userEvent.click(await screen.findByText('environment'));
      // Select dev
      await userEvent.click(
        await screen.findByLabelText(
          'environment, dev, 100% of all events. View events with this tag value.'
        )
      );

      // Expand foo tag
      await userEvent.click(await screen.findByText('foo'));
      // Select bar
      await userEvent.click(
        await screen.findByLabelText(
          'foo, bar, 100% of all events. View events with this tag value.'
        )
      );

      expect(router.push).toHaveBeenCalledTimes(2);

      expect(router.push).toHaveBeenNthCalledWith(1, {
        pathname: '/',
        query: {
          project: '2',
          query: 'tags[environment]:dev',
          transaction: '/performance',
          transactionCursor: '1:0:0',
        },
      });

      expect(router.push).toHaveBeenNthCalledWith(2, {
        pathname: '/',
        query: {
          project: '2',
          query: 'foo:bar',
          transaction: '/performance',
          transactionCursor: '1:0:0',
        },
      });
    });

    it('does not use MEP dataset for stats query without features', async function () {
      const {organization, router} = initializeData({
        query: {query: 'transaction.op:pageload'}, // transaction.op is covered by the metrics dataset
        features: [''], // No 'dynamic-sampling' feature to indicate it can use metrics dataset or metrics enhanced.
      });

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Transaction Summary');

      await screen.findByRole('heading', {name: 'Apdex'});
      expect(await screen.findByTestId('apdex-summary-value')).toHaveTextContent('0.6');

      expect(eventStatsMock).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            environment: [],
            interval: '30m',
            partial: '1',
            project: [2],
            query:
              'transaction.op:pageload event.type:transaction transaction:/performance',
            referrer: 'api.performance.transaction-summary.duration-chart',
            statsPeriod: '14d',
            yAxis: [
              'p50(transaction.duration)',
              'p75(transaction.duration)',
              'p95(transaction.duration)',
              'p99(transaction.duration)',
              'p100(transaction.duration)',
              'avg(transaction.duration)',
            ],
          }),
        })
      );
    });

    it('uses MEP dataset for stats query', async function () {
      const {organization, router} = initializeData({
        query: {query: 'transaction.op:pageload'}, // transaction.op is covered by the metrics dataset
        features: ['dynamic-sampling', 'mep-rollout-flag'],
      });

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Transaction Summary');

      // Renders Apdex widget
      await screen.findByRole('heading', {name: 'Apdex'});
      expect(await screen.findByTestId('apdex-summary-value')).toHaveTextContent('0.5');

      expect(eventStatsMock).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query:
              'transaction.op:pageload event.type:transaction transaction:/performance',
            dataset: 'metricsEnhanced',
          }),
        })
      );

      // Renders Failure Rate widget
      expect(screen.getByRole('heading', {name: 'Failure Rate'})).toBeInTheDocument();
      expect(screen.getByTestId('failure-rate-summary-value')).toHaveTextContent('100%');

      expect(
        screen.queryByTestId('search-metrics-fallback-warning')
      ).not.toBeInTheDocument();
    });

    it('does not use MEP dataset for stats query if cardinality fallback fails', async function () {
      MockApiClient.addMockResponse({
        method: 'GET',
        url: `/organizations/org-slug/metrics-compatibility-sums/`,
        body: {
          sum: {
            metrics: 100,
            metrics_null: 100,
            metrics_unparam: 0,
          },
        },
      });
      const {organization, router} = initializeData({
        query: {query: 'transaction.op:pageload'}, // transaction.op is covered by the metrics dataset
        features: ['dynamic-sampling', 'mep-rollout-flag'],
      });

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Transaction Summary');

      // Renders Apdex widget
      await screen.findByRole('heading', {name: 'Apdex'});
      expect(await screen.findByTestId('apdex-summary-value')).toHaveTextContent('0.6');

      expect(eventStatsMock).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query:
              'transaction.op:pageload event.type:transaction transaction:/performance',
          }),
        })
      );
    });

    it('uses MEP dataset for stats query and shows fallback warning', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/?limit=5&project=2&query=has%3Anot-compatible%20is%3Aunresolved%20transaction%3A%2Fperformance&sort=trends&statsPeriod=14d',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {
          meta: {
            fields: {
              'count()': 'number',
              'apdex()': 'number',
              'count_miserable_user()': 'number',
              'user_misery()': 'number',
              'count_unique_user()': 'number',
              'p95()': 'number',
              'failure_rate()': 'number',
              'tpm()': 'number',
              project_threshold_config: 'string',
            },
            isMetricsData: false, // The total response is setting the metrics fallback behaviour.
          },
          data: [
            {
              'count()': 200,
              'apdex()': 0.5,
              'count_miserable_user()': 120,
              'user_misery()': 0.1,
              'count_unique_user()': 100,
              'p95()': 731.3132,
              'failure_rate()': 1,
              'tpm()': 100,
              project_threshold_config: ['duration', 300],
            },
          ],
        },
        match: [
          (_url, options) => {
            const isMetricsEnhanced =
              options.query?.dataset === DiscoverDatasets.METRICS_ENHANCED;
            return (
              options.query?.field?.includes('p95()') &&
              isMetricsEnhanced &&
              options.query?.query?.includes('not-compatible')
            );
          },
        ],
      });
      const {organization, router} = initializeData({
        query: {query: 'transaction.op:pageload has:not-compatible'}, // Adds incompatible w/ metrics tag
        features: ['dynamic-sampling', 'mep-rollout-flag'],
      });

      render(
        <TestComponent
          organization={organization}
          router={router}
          location={router.location}
        />,
        {
          router,
          organization,
        }
      );

      await screen.findByText('Transaction Summary');

      // Renders Apdex widget
      await screen.findByRole('heading', {name: 'Apdex'});
      expect(await screen.findByTestId('apdex-summary-value')).toHaveTextContent('0.5');

      expect(eventStatsMock).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query:
              'transaction.op:pageload has:not-compatible event.type:transaction transaction:/performance',
            dataset: 'metricsEnhanced',
          }),
        })
      );

      // Renders Failure Rate widget
      expect(screen.getByRole('heading', {name: 'Failure Rate'})).toBeInTheDocument();
      expect(screen.getByTestId('failure-rate-summary-value')).toHaveTextContent('100%');
      expect(
        await screen.findByTestId('search-metrics-fallback-warning')
      ).toBeInTheDocument();
    });
  });
});
