import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {DatabaseSpanSummaryPage} from 'sentry/views/insights/database/views/databaseSpanSummaryPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useParams');
jest.mock('sentry/utils/usePageFilters');

jest.mock('sentry/utils/useReleaseStats');

describe('DatabaseSpanSummaryPage', () => {
  const organization = OrganizationFixture({
    features: ['insight-modules'],
  });
  const group = GroupFixture();
  const groupId = '1756baf8fd19c116';

  jest.mocked(usePageFilters).mockReturnValue(
    PageFilterStateFixture({
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
    })
  );

  jest.mocked(useParams).mockReturnValue({
    groupId,
  });

  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {statsPeriod: '10d', transactionsCursor: '0:25:0'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useReleaseStats).mockReturnValue({
    isLoading: false,
    isPending: false,
    isError: false,
    error: null,
    releases: [],
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it('renders', async () => {
    const eventsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            'span.op': 'db',
            'span.description': 'SELECT thing FROM my_table;',
          },
        ],
      },
    });

    const eventsStatsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'epm()',
          }),
          TimeSeriesFixture({
            yAxis: 'avg(span.self_time)',
          }),
        ],
      },
    });

    const spanDescriptionRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.span-description',
        }),
      ],
      method: 'GET',
      body: {
        data: [
          {
            'span.group': '1756baf8fd19c116',
            'span.description': 'SELECT * FROM users',
            'db.system': 'postgresql',
            'code.filepath': 'app/models/user.rb',
            'code.lineno': 10,
            'code.function': 'User.find_by_id',
            'sdk.name': 'ruby',
            'sdk.version': '3.2.0',
            release: '1.0.0',
            platform: 'ruby',
          },
        ],
      },
    });

    const transactionListMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.span-transaction-metrics',
        }),
      ],
      body: {
        data: [
          {
            transaction: '/api/users',
            'transaction.method': 'GET',
            'span.op': 'db',
            'epm()': 17.88,
            'avg(span.self_time)': 204.5,
            'sum(span.self_time)': 177238,
          },
        ],
        meta: {
          fields: {
            'epm()': 'rate',
            'avg(span.self_time)': 'duration',
            'sum(span.self_time)': 'duration',
          },
        },
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug//releases/1.0.0/`,
      method: 'GET',
      body: [],
    });

    const issuesRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      method: 'GET',
      body: [
        {
          ...group,
          metadata: {
            value: 'SELECT * FROM users',
          },
        },
      ],
    });

    render(<DatabaseSpanSummaryPage />, {
      organization,
      initialRouterConfig: {
        route: `/organizations/:orgId/insights/backend/database/spans/span/:groupId/`,
        location: {
          pathname: `/organizations/${organization.slug}/insights/backend/database/spans/span/${groupId}/`,
        },
      },
    });

    // Metrics ribbon
    expect(eventsRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          environment: [],
          field: [
            'sentry.normalized_description',
            'epm()',
            'sum(span.self_time)',
            'avg(span.self_time)',
          ],
          per_page: 50,
          project: [],
          query: 'span.group:1756baf8fd19c116',
          referrer: 'api.insights.span-summary-page-metrics',
          sampling: SAMPLING_MODE.NORMAL,
          statsPeriod: '10d',
        },
      })
    );

    // Full span description
    expect(spanDescriptionRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          sampling: SAMPLING_MODE.NORMAL,
          environment: [],
          field: [
            'project.id',
            'span.description',
            'db.system',
            'code.filepath',
            'code.lineno',
            'code.function',
            'sdk.name',
            'sdk.version',
            'release',
            'platform',
          ],
          per_page: 1,
          project: [],
          sort: '-code.filepath',
          query: 'span.group:1756baf8fd19c116',
          referrer: 'api.insights.span-description',
          statsPeriod: '10d',
        },
      })
    );

    // EPM Chart
    expect(eventsStatsRequestMock).toHaveBeenNthCalledWith(
      1,
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
          sort: undefined,
          partial: 1,
          project: [],
          query: 'span.group:1756baf8fd19c116',
          referrer: 'api.insights.database.summary-throughput-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: ['epm()'],
          caseInsensitive: undefined,
        },
      })
    );

    // Duration Chart
    expect(eventsStatsRequestMock).toHaveBeenNthCalledWith(
      2,
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
          sort: undefined,
          partial: 1,
          project: [],
          query: 'span.group:1756baf8fd19c116',
          referrer: 'api.insights.database.summary-duration-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: ['avg(span.self_time)'],
          caseInsensitive: undefined,
        },
      })
    );

    // Transactions table
    expect(transactionListMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spans',
          environment: [],
          field: [
            'transaction',
            'transaction.method',
            'epm()',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'http_response_count(5)',
          ],
          per_page: 25,
          cursor: '0:25:0',
          project: [],
          query: 'span.group:1756baf8fd19c116',
          sort: '-sum(span.self_time)',
          referrer: 'api.insights.span-transaction-metrics',
          sampling: SAMPLING_MODE.NORMAL,
          statsPeriod: '10d',
        },
      })
    );

    expect(spanDescriptionRequestMock).toHaveBeenCalledTimes(1);
    expect(eventsRequestMock).toHaveBeenCalledTimes(1);
    expect(eventsStatsRequestMock).toHaveBeenCalledTimes(2);
    expect(transactionListMock).toHaveBeenCalledTimes(1);

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    // Issues request. This runs after the indexed span has loaded
    expect(issuesRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/issues/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          query:
            'issue.type:[performance_slow_db_query,performance_n_plus_one_db_queries] message:"SELECT * FROM users"',
          environment: [],
          limit: 100,
          project: [],
          statsPeriod: '10d',
        },
      })
    );

    expect(screen.getByRole('table', {name: 'Transactions'})).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: 'Found In'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Queries Per Minute'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Avg Duration'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Time Spent'})).toBeInTheDocument();

    expect(screen.getByText('GET /api/users')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'GET /api/users'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/insights/backend/database/spans/span/1756baf8fd19c116?statsPeriod=10d&transaction=%2Fapi%2Fusers&transactionMethod=GET&transactionsCursor=0%3A25%3A0'
    );
    expect(screen.getByText('17.9/s')).toBeInTheDocument();
    expect(screen.getByText('204.50ms')).toBeInTheDocument();
    expect(screen.getByText('2.95min')).toBeInTheDocument();

    expect(await screen.findByText('1 Related Issue')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Graph'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Events'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Users'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Assignee'})).toBeInTheDocument();
    expect(screen.getByText('327k')).toBeInTheDocument();
    expect(screen.getByText('35k')).toBeInTheDocument();
  });
});
