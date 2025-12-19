import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {CacheLandingPage} from 'sentry/views/insights/cache/views/cacheLandingPage';

jest.mock('sentry/utils/useReleaseStats');

const requestMocks = {
  missRateChart: jest.fn(),
  cacheSamplesMissRateChart: jest.fn(),
  throughputChart: jest.fn(),
  cacheMissRateError: jest.fn(),
  spanTransactionList: jest.fn(),
  transactionDurations: jest.fn(),
  spanFields: jest.fn(),
};

describe('CacheLandingPage', () => {
  const organization = OrganizationFixture({features: ['insight-modules']});

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/insights/backend/caches/`,
      query: {statsPeriod: '10d', project: '1'},
    },
    route: `/organizations/:orgId/insights/backend/caches/`,
  };

  ProjectsStore.loadInitialData([
    ProjectFixture({
      id: '1',
      name: 'Backend',
      slug: 'backend',
      firstTransactionEvent: true,
      hasInsightsCaches: true,
      platform: 'javascript',
    }),
  ]);

  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {period: '10d', start: null, end: null, utc: false},
    });

    jest.clearAllMocks();
    setRequestMocks(organization);
  });

  it('fetches module data', async () => {
    render(<CacheLandingPage />, {
      organization,
      initialRouterConfig,
    });

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(requestMocks.throughputChart).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-timeseries/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          excludeOther: 0,
          groupBy: undefined,
          interval: '30m',
          partial: 1,
          project: [],
          query: 'span.op:[cache.get_item,cache.get]',
          referrer: 'api.insights.cache.landing-cache-throughput-chart',
          statsPeriod: '10d',
          yAxis: ['epm()'],
          caseInsensitive: undefined,
        },
      })
    );
    expect(requestMocks.spanTransactionList).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          field: [
            'project',
            'project.id',
            'transaction',
            'epm()',
            'cache_miss_rate()',
            'sum(span.self_time)',
            'avg(cache.item_size)',
          ],
          per_page: 20,
          project: [],
          query: 'span.op:[cache.get_item,cache.get]',
          referrer: 'api.insights.cache.landing-cache-transaction-list',
          sort: '-sum(span.self_time)',
          statsPeriod: '10d',
        },
      })
    );
    expect(requestMocks.transactionDurations).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          field: ['avg(span.duration)', 'transaction'],
          per_page: 50,
          noPagination: true,
          project: [],
          query: 'transaction:["my-transaction"] AND is_transaction:true',
          referrer: 'api.insights.cache.landing-cache-transaction-duration',
          statsPeriod: '10d',
        },
      })
    );
  });

  it('should escape quote in transaction name', async () => {
    requestMocks.spanTransactionList.mockClear();
    requestMocks.spanTransactionList = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.cache.landing-cache-transaction-list',
        }),
      ],
      body: {
        data: [
          {
            transaction: 'transaction with "quote"',
            project: 'backend',
            'project.id': 123,
            'avg(cache.item_size)': 123,
            'epm()': 123,
            'sum(span.self_time)': 123,
            'cache_miss_rate()': 0.123,
          },
        ],
        meta: {
          fields: {
            transaction: 'string',
            project: 'string',
            'project.id': 'integer',
            'avg(cache.item_size)': 'number',
            'epm()': 'rate',
            'sum(span.self_time)': 'duration',
            'cache_miss_rate()': 'percentage',
          },
          units: {},
        },
      },
    });

    render(<CacheLandingPage />, {
      organization,
      initialRouterConfig,
    });

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(requestMocks.transactionDurations).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          field: ['avg(span.duration)', 'transaction'],
          noPagination: true,
          per_page: 50,
          project: [],
          query: 'transaction:["transaction with \\"quote\\""] AND is_transaction:true',
          referrer: 'api.insights.cache.landing-cache-transaction-duration',
          statsPeriod: '10d',
        },
      })
    );
  });

  it('renders a list of transactions', async () => {
    render(<CacheLandingPage />, {
      organization,
      initialRouterConfig,
    });
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
      '/organizations/org-slug/insights/projects/backend/?project=1'
    );

    expect(
      screen.getByRole('columnheader', {name: 'Avg Value Size'})
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '123 B'})).toBeInTheDocument();

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

  it('shows module onboarding', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({
        id: '1',
        name: 'Backend',
        slug: 'backend',
        firstTransactionEvent: true,
        hasInsightsCaches: false,
        platform: 'javascript',
      }),
    ]);

    render(<CacheLandingPage />, {
      organization,
      initialRouterConfig,
    });

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
    url: `/organizations/${organization.slug}/events-timeseries/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.insights.cache.landing-cache-hit-miss-chart',
        yAxis: ['cache_miss_rate()'],
      }),
    ],
    body: {
      timeSeries: [
        TimeSeriesFixture({
          yAxis: 'cache_miss_rate()',
          values: [
            {value: 0.5, timestamp: 1716379200000},
            {value: 0.75, timestamp: 1716393600000},
          ],
        }),
      ],
    },
  });

  requestMocks.throughputChart = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events-timeseries/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.insights.cache.landing-cache-throughput-chart',
      }),
    ],
    body: {
      timeSeries: [
        TimeSeriesFixture({
          yAxis: 'epm()',
          values: [
            {value: 100, timestamp: 1716379200000},
            {value: 200, timestamp: 1716393600000},
          ],
        }),
      ],
    },
  });

  requestMocks.spanTransactionList = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/events/`,
    method: 'GET',
    match: [
      MockApiClient.matchQuery({
        referrer: 'api.insights.cache.landing-cache-transaction-list',
      }),
    ],
    body: {
      data: [
        {
          transaction: 'my-transaction',
          project: 'backend',
          'project.id': 123,
          'avg(cache.item_size)': 123,
          'epm()': 123,
          'sum(span.self_time)': 123,
          'cache_miss_rate()': 0.123,
        },
      ],
      meta: {
        fields: {
          transaction: 'string',
          project: 'string',
          'project.id': 'integer',
          'avg(cache.item_size)': 'number',
          'epm()': 'rate',
          'sum(span.self_time)': 'duration',
          'cache_miss_rate()': 'percentage',
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
        referrer: 'api.insights.cache.landing-cache-transaction-duration',
      }),
    ],
    body: {
      data: [
        {
          transaction: 'my-transaction',
          'avg(span.duration)': 456,
        },
      ],
      meta: {
        fields: {
          transaction: 'string',
          'avg(span.duration)': 'duration',
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
