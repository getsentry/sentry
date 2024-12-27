import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {CacheLandingPage} from 'sentry/views/insights/cache/views/cacheLandingPage';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useProjects');
jest.mock('sentry/views/insights/common/queries/useOnboardingProject');

const requestMocks = {
  missRateChart: jest.fn(),
  cacheSamplesMissRateChart: jest.fn(),
  throughputChart: jest.fn(),
  spanTransactionList: jest.fn(),
  transactionDurations: jest.fn(),
  spanFields: jest.fn(),
};

describe('CacheLandingPage', function () {
  const organization = OrganizationFixture({features: ['insights-addon-modules']});

  jest.mocked(usePageFilters).mockReturnValue({
    isReady: true,
    desyncedFilters: new Set(),
    pinnedFilters: new Set(),
    shouldPersist: true,
    selection: {
      datetime: {
        period: '10d',
        start: null,
        end: null,
        utc: false,
      },
      environments: [],
      projects: [],
    },
  });

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d', project: '1'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useProjects).mockReturnValue({
    projects: [
      ProjectFixture({
        id: '1',
        name: 'Backend',
        slug: 'backend',
        firstTransactionEvent: true,
        hasInsightsCaches: true,
        platform: 'javascript',
      }),
    ],
    onSearch: jest.fn(),
    reloadProjects: jest.fn(),
    placeholders: [],
    fetching: false,
    hasMore: null,
    fetchError: null,
    initiallyLoaded: false,
  });

  beforeEach(function () {
    jest.clearAllMocks();
    setRequestMocks(organization);
  });

  afterAll(function () {
    jest.resetAllMocks();
  });

  it('fetches module data', async function () {
    render(<CacheLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(requestMocks.missRateChart).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-stats/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          cursor: undefined,
          dataset: 'spansMetrics',
          environment: [],
          excludeOther: 0,
          field: [],
          interval: '30m',
          orderby: undefined,
          partial: 1,
          per_page: 50,
          project: [],
          query: 'span.op:[cache.get_item,cache.get] project.id:1',
          referrer: 'api.performance.cache.samples-cache-hit-miss-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'cache_miss_rate()',
        },
      })
    );
    expect(requestMocks.throughputChart).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-stats/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          cursor: undefined,
          dataset: 'spansMetrics',
          environment: [],
          excludeOther: 0,
          field: [],
          interval: '30m',
          orderby: undefined,
          partial: 1,
          per_page: 50,
          project: [],
          query: 'span.op:[cache.get_item,cache.get]',
          referrer: 'api.performance.cache.landing-cache-throughput-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'spm()',
        },
      })
    );
    expect(requestMocks.spanTransactionList).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'project',
            'project.id',
            'transaction',
            'spm()',
            'cache_miss_rate()',
            'sum(span.self_time)',
            'time_spent_percentage()',
            'avg(cache.item_size)',
          ],
          per_page: 20,
          project: [],
          query: 'span.op:[cache.get_item,cache.get]',
          referrer: 'api.performance.cache.landing-cache-transaction-list',
          sort: '-time_spent_percentage()',
          statsPeriod: '10d',
        },
      })
    );
    expect(requestMocks.transactionDurations).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'metrics',
          environment: [],
          field: ['avg(transaction.duration)', 'transaction'],
          per_page: 50,
          noPagination: true,
          project: [],
          query: 'transaction:["my-transaction"]',
          referrer: 'api.performance.cache.landing-cache-transaction-duration',
          statsPeriod: '10d',
        },
      })
    );
  });

  it('should escape quote in transaction name', async function () {
    requestMocks.spanTransactionList.mockClear();
    requestMocks.spanTransactionList = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.performance.cache.landing-cache-transaction-list',
        }),
      ],
      body: {
        data: [
          {
            transaction: 'transaction with "quote"',
            project: 'backend',
            'project.id': 123,
            'avg(cache.item_size)': 123,
            'spm()': 123,
            'sum(span.self_time)': 123,
            'cache_miss_rate()': 0.123,
            'time_spent_percentage()': 0.123,
          },
        ],
        meta: {
          fields: {
            transaction: 'string',
            project: 'string',
            'project.id': 'integer',
            'avg(cache.item_size)': 'number',
            'spm()': 'rate',
            'sum(span.self_time)': 'duration',
            'cache_miss_rate()': 'percentage',
            'time_spent_percentage()': 'percentage',
          },
          units: {},
        },
      },
    });

    render(<CacheLandingPage />, {organization});

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(requestMocks.transactionDurations).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'metrics',
          environment: [],
          field: ['avg(transaction.duration)', 'transaction'],
          noPagination: true,
          per_page: 50,
          project: [],
          query: 'transaction:["transaction with \\"quote\\""]',
          referrer: 'api.performance.cache.landing-cache-transaction-duration',
          statsPeriod: '10d',
        },
      })
    );
  });

  it('renders a list of transactions', async function () {
    render(<CacheLandingPage />, {organization});
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    expect(screen.getByRole('columnheader', {name: 'Transaction'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'my-transaction'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'my-transaction'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/backend/caches/?project=123&statsPeriod=10d&transaction=my-transaction'
    );

    expect(screen.getByRole('columnheader', {name: 'Project'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'View Project Details'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View Project Details'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/projects/backend/?project=1'
    );

    expect(
      screen.getByRole('columnheader', {name: 'Avg Value Size'})
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '123.0 B'})).toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', {name: 'Requests Per Minute'})
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '123/s'})).toBeInTheDocument();

    expect(
      screen.getByRole('columnheader', {name: 'Avg Transaction Duration'})
    ).toBeInTheDocument();
    const avgTxnCell = screen
      .getAllByRole('cell')
      .find(cell => cell?.textContent?.includes('456.00ms'));
    expect(avgTxnCell).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: 'Miss Rate'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '12.3%'})).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: 'Time Spent'})).toBeInTheDocument();
    const timeSpentCell = screen
      .getAllByRole('cell')
      .find(cell => cell?.textContent?.includes('123.00ms'));
    expect(timeSpentCell).toBeInTheDocument();
  });

  it('shows module onboarding', async function () {
    jest.mocked(useOnboardingProject).mockReturnValue(undefined);
    jest.mocked(useProjects).mockReturnValue({
      projects: [
        ProjectFixture({
          id: '1',
          name: 'Backend',
          slug: 'backend',
          firstTransactionEvent: true,
          hasInsightsCaches: false,
          platform: 'javascript',
        }),
      ],
      onSearch: jest.fn(),
      reloadProjects: jest.fn(),
      placeholders: [],
      fetching: false,
      hasMore: null,
      fetchError: null,
      initiallyLoaded: false,
    });

    render(<CacheLandingPage />, {organization});

    await waitFor(() => {
      expect(
        screen.getByText('Bringing you one less hard problem in computer science')
      ).toBeInTheDocument();
    });
  });
});

const setRequestMocks = (organization: Organization) => {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/projects/`,
    body: [ProjectFixture({name: 'backend'})],
  });

  requestMocks.missRateChart = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-stats/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.performance.cache.landing-cache-hit-miss-chart',
      }),
    ],
    body: {
      data: [
        [1716379200, [{count: 0.5}]],
        [1716393600, [{count: 0.75}]],
      ],
      meta: {
        fields: {
          time: 'date',
          cache_miss_rate: 'percentage',
        },
      },
    },
  });

  requestMocks.missRateChart = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-stats/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.performance.cache.samples-cache-hit-miss-chart',
      }),
    ],
    body: {
      data: [
        [1716379200, [{count: 0.5}]],
        [1716393600, [{count: 0.75}]],
      ],
      meta: {
        fields: {
          time: 'date',
          cache_miss_rate: 'percentage',
        },
      },
    },
  });

  requestMocks.throughputChart = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-stats/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.performance.cache.landing-cache-throughput-chart',
      }),
    ],
    body: {
      data: [
        [1716379200, [{count: 100}]],
        [1716393600, [{count: 200}]],
      ],
      meta: {
        fields: {
          time: 'date',
          spm_14400: 'rate',
        },
      },
    },
  });

  requestMocks.spanTransactionList = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.performance.cache.landing-cache-transaction-list',
      }),
    ],
    body: {
      data: [
        {
          transaction: 'my-transaction',
          project: 'backend',
          'project.id': 123,
          'avg(cache.item_size)': 123,
          'spm()': 123,
          'sum(span.self_time)': 123,
          'cache_miss_rate()': 0.123,
          'time_spent_percentage()': 0.123,
        },
      ],
      meta: {
        fields: {
          transaction: 'string',
          project: 'string',
          'project.id': 'integer',
          'avg(cache.item_size)': 'number',
          'spm()': 'rate',
          'sum(span.self_time)': 'duration',
          'cache_miss_rate()': 'percentage',
          'time_spent_percentage()': 'percentage',
        },
        units: {},
      },
    },
  });

  requestMocks.transactionDurations = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.performance.cache.landing-cache-transaction-duration',
      }),
    ],
    body: {
      data: [
        {
          transaction: 'my-transaction',
          'avg(transaction.duration)': 456,
        },
      ],
      meta: {
        fields: {
          transaction: 'string',
          'avg(transaction.duration)': 'duration',
        },
        units: {},
      },
    },
  });

  requestMocks.spanFields = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/spans/fields/`,
    method: 'GET',
    body: [],
  });
};
