import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as pageFilters from 'sentry/actionCreators/pageFilters';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {browserHistory} from 'sentry/utils/browserHistory';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import PerformanceContent from 'sentry/views/performance/content';
import {DEFAULT_MAX_DURATION} from 'sentry/views/performance/trends/utils';

const FEATURES = ['performance-view'];

function WrappedComponent({router}) {
  return (
    <MEPSettingProvider>
      <PerformanceContent router={router} location={router.location} />
    </MEPSettingProvider>
  );
}

function initializeData(projects, query, features = FEATURES) {
  const organization = OrganizationFixture({
    features,
  });
  const initialData = initializeOrg({
    projects,
    organization,
    router: {
      location: {
        pathname: '/test',
        query: query || {},
      },
    },
  });
  act(() => void OrganizationStore.onUpdate(initialData.organization, {replace: true}));
  act(() => ProjectsStore.loadInitialData(initialData.projects));
  return initialData;
}

function initializeTrendsData(query, addDefaultQuery = true) {
  const projects = [
    ProjectFixture({id: '1', firstTransactionEvent: false}),
    ProjectFixture({id: '2', firstTransactionEvent: true}),
  ];
  const organization = OrganizationFixture({features: FEATURES});

  const otherTrendsQuery = addDefaultQuery
    ? {
        query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
      }
    : {};

  const initialData = initializeOrg({
    organization,
    projects,
    router: {
      location: {
        pathname: '/test',
        query: {
          ...otherTrendsQuery,
          ...query,
        },
      },
    },
  });
  act(() => ProjectsStore.loadInitialData(initialData.projects));
  return initialData;
}

describe('Performance > Content', function () {
  beforeEach(function () {
    act(() => void TeamStore.loadInitialData([], false, null));
    browserHistory.push = jest.fn();
    jest.spyOn(pageFilters, 'updateDateTime');

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
      url: '/organizations/org-slug/events-histogram/',
      body: {'transaction.duration': [{bin: 0, count: 1000}]},
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
      url: '/organizations/org-slug/events/',
      body: {
        meta: {
          fields: {
            user: 'string',
            transaction: 'string',
            'project.id': 'integer',
            'tpm()': 'number',
            'p50()': 'number',
            'p95()': 'number',
            'failure_rate()': 'number',
            'apdex(300)': 'number',
            'count_unique(user)': 'number',
            'count_miserable(user,300)': 'number',
            'user_misery(300)': 'number',
          },
        },
        data: [
          {
            transaction: '/apple/cart',
            'project.id': 1,
            user: 'uhoh@example.com',
            'tpm()': 30,
            'p50()': 100,
            'p95()': 500,
            'failure_rate()': 0.1,
            'apdex(300)': 0.6,
            'count_unique(user)': 1000,
            'count_miserable(user,300)': 122,
            'user_misery(300)': 0.114,
          },
        ],
      },
      match: [
        (_, options) => {
          if (!options.hasOwnProperty('query')) {
            return false;
          }
          if (!options.query?.hasOwnProperty('field')) {
            return false;
          }
          return !options.query?.field.includes('team_key_transaction');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {
          fields: {
            user: 'string',
            transaction: 'string',
            'project.id': 'integer',
            'tpm()': 'number',
            'p50()': 'number',
            'p95()': 'number',
            'failure_rate()': 'number',
            'apdex(300)': 'number',
            'count_unique(user)': 'number',
            'count_miserable(user,300)': 'number',
            'user_misery(300)': 'number',
          },
        },
        data: [
          {
            team_key_transaction: 1,
            transaction: '/apple/cart',
            'project.id': 1,
            user: 'uhoh@example.com',
            'tpm()': 30,
            'p50()': 100,
            'p95()': 500,
            'failure_rate()': 0.1,
            'apdex(300)': 0.6,
            'count_unique(user)': 1000,
            'count_miserable(user,300)': 122,
            'user_misery(300)': 0.114,
          },
          {
            team_key_transaction: 0,
            transaction: '/apple/checkout',
            'project.id': 1,
            user: 'uhoh@example.com',
            'tpm()': 30,
            'p50()': 100,
            'p95()': 500,
            'failure_rate()': 0.1,
            'apdex(300)': 0.6,
            'count_unique(user)': 1000,
            'count_miserable(user,300)': 122,
            'user_misery(300)': 0.114,
          },
        ],
      },
      match: [
        (_, options) => {
          if (!options.hasOwnProperty('query')) {
            return false;
          }
          if (!options.query?.hasOwnProperty('field')) {
            return false;
          }
          return options.query?.field.includes('team_key_transaction');
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {
        count: 2,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-trends/',
      body: {
        stats: {},
        events: {meta: {}, data: []},
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-trends-stats/',
      body: {
        stats: {},
        events: {meta: {}, data: []},
      },
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
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    act(() => ProjectsStore.reset());

    // TODO: This was likely a defensive check added due to a previous isolation issue, it can possibly be removed.
    // @ts-expect-error
    pageFilters.updateDateTime.mockRestore();
  });

  it('renders basic UI elements', async function () {
    const projects = [ProjectFixture({firstTransactionEvent: true})];
    const {router} = initializeData(projects, {});

    render(<WrappedComponent router={router} />, {
      router,
    });

    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();
    expect(screen.getByTestId('performance-table')).toBeInTheDocument();
    expect(screen.queryByText('Pinpoint problems')).not.toBeInTheDocument();
  });

  it('renders onboarding state when the selected project has no events', async function () {
    const projects = [
      ProjectFixture({id: '1', firstTransactionEvent: false}),
      ProjectFixture({id: '2', firstTransactionEvent: true}),
    ];
    const {router} = initializeData(projects, {project: [1]});

    render(<WrappedComponent router={router} />, {
      router,
    });

    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();
    expect(screen.queryByText('Pinpoint problems')).toBeInTheDocument();
    expect(screen.queryByTestId('performance-table')).not.toBeInTheDocument();
  });

  it('does not render onboarding for "my projects"', async function () {
    const projects = [
      ProjectFixture({id: '1', firstTransactionEvent: false}),
      ProjectFixture({id: '2', firstTransactionEvent: true}),
    ];
    const {router} = initializeData(projects, {project: ['-1']});

    render(<WrappedComponent router={router} />, {
      router,
    });
    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();
    expect(screen.queryByText('Pinpoint problems')).not.toBeInTheDocument();
  });

  it('forwards conditions to transaction summary', async function () {
    const projects = [ProjectFixture({id: '1', firstTransactionEvent: true})];
    const {router} = initializeData(projects, {project: ['1'], query: 'sentry:yes'});

    render(<WrappedComponent router={router} />, {
      router,
    });

    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();
    const link = screen.getByRole('link', {name: '/apple/cart'});

    await userEvent.click(link);

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          transaction: '/apple/cart',
          query: 'sentry:yes',
        }),
      })
    );
  });

  it('Default period for trends does not call updateDateTime', async function () {
    const {router} = initializeTrendsData({query: 'tag:value'}, false);
    render(<WrappedComponent router={router} />, {
      router,
    });

    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();

    expect(pageFilters.updateDateTime).toHaveBeenCalledTimes(0);
  });

  it('Navigating to trends does not modify statsPeriod when already set', async function () {
    const {router} = initializeTrendsData({
      query: `tpm():>0.005 transaction.duration:>10 transaction.duration:<${DEFAULT_MAX_DURATION} api`,
      statsPeriod: '24h',
    });

    render(<WrappedComponent router={router} />, {
      router,
    });

    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();
    const link = screen.getByRole('button', {name: 'View Trends'});

    await userEvent.click(link);

    expect(pageFilters.updateDateTime).toHaveBeenCalledTimes(0);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/trends/',
        query: {
          query: `tpm():>0.005 transaction.duration:>10 transaction.duration:<${DEFAULT_MAX_DURATION}`,
          statsPeriod: '24h',
        },
      })
    );
  });

  it('Default page (transactions) without trends feature will not update filters if none are set', async function () {
    const projects = [
      ProjectFixture({id: '1', firstTransactionEvent: false}),
      ProjectFixture({id: '2', firstTransactionEvent: true}),
    ];
    const {router} = initializeData(projects, {view: undefined});

    render(<WrappedComponent router={router} />, {
      router,
    });
    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();

    expect(browserHistory.push).toHaveBeenCalledTimes(0);
  });

  it('Default page (transactions) with trends feature will not update filters if none are set', async function () {
    const {router} = initializeTrendsData({view: undefined}, false);

    render(<WrappedComponent router={router} />, {
      router,
    });
    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();
    expect(browserHistory.push).toHaveBeenCalledTimes(0);
  });

  it('Tags are replaced with trends default query if navigating to trends', async function () {
    const {router} = initializeTrendsData({query: 'device.family:Mac'}, false);

    render(<WrappedComponent router={router} />, {
      router,
    });

    const trendsLinks = await screen.findAllByTestId('landing-header-trends');
    await userEvent.click(trendsLinks[0]);

    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/performance/trends/',
        query: {
          query: `tpm():>0.01 transaction.duration:>0 transaction.duration:<${DEFAULT_MAX_DURATION}`,
        },
      })
    );
  });

  it('Display Create Sample Transaction Button', async function () {
    const projects = [
      ProjectFixture({id: '1', firstTransactionEvent: false}),
      ProjectFixture({id: '2', firstTransactionEvent: false}),
    ];
    const {router} = initializeData(projects, {view: undefined});

    render(<WrappedComponent router={router} />, {
      router,
    });

    expect(await screen.findByTestId('performance-landing-v3')).toBeInTheDocument();
    expect(screen.queryByTestId('create-sample-transaction-btn')).toBeInTheDocument();
  });
});
