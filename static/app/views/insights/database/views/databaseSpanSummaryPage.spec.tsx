import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {DatabaseSpanSummaryPage} from 'sentry/views/insights/database/views/databaseSpanSummaryPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
import {useReleaseStats} from 'sentry/utils/useReleaseStats';

jest.mock('sentry/utils/useReleaseStats');

describe('DatabaseSpanSummaryPage', function () {
  const organization = OrganizationFixture({
    features: ['insights-related-issues-table', 'insights-initial-modules'],
  });
  const group = GroupFixture();

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
        utc: null,
      },
      environments: [],
      projects: [],
    },
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

  beforeEach(function () {
    jest.clearAllMocks();
  });

  afterAll(function () {
    jest.resetAllMocks();
  });

  it('renders', async function () {
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
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        'epm()': {
          data: [
            [1672531200, [{count: 5}]],
            [1672542000, [{count: 10}]],
            [1672552800, [{count: 15}]],
          ],
          order: 0,
          start: 1672531200,
          end: 1672552800,
        },
        'avg(span.self_time)': {
          data: [
            [1672531200, [{count: 100}]],
            [1672542000, [{count: 150}]],
            [1672552800, [{count: 200}]],
          ],
          order: 1,
          start: 1672531200,
          end: 1672552800,
        },
      },
    });

    const spanDescriptionRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.starfish.span-description',
        }),
      ],
      method: 'GET',
      body: {
        data: [
          {
            'span.group': '1756baf8fd19c116',
            'span.description': 'SELECT * FROM users',
          },
        ],
      },
    });

    const transactionListMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.starfish.span-transaction-metrics',
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
            'time_spent_percentage()': 0.00341,
          },
        ],
        meta: {
          fields: {
            'epm()': 'rate',
            'avg(span.self_time)': 'duration',
            'sum(span.self_time)': 'duration',
            'time_spent_percentage()': 'percentage',
          },
        },
      },
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

    render(
      <DatabaseSpanSummaryPage
        {...RouteComponentPropsFixture()}
        params={{
          groupId: '1756baf8fd19c116',
        }}
      />,
      {organization}
    );

    // Metrics ribbon
    expect(eventsRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'span.op',
            'span.description',
            'span.action',
            'span.domain',
            'count()',
            'epm()',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'time_spent_percentage()',
            'http_response_count(5)',
          ],
          per_page: 50,
          project: [],
          query: 'span.group:1756baf8fd19c116',
          referrer: 'api.starfish.span-summary-page-metrics',
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
          dataset: 'spansIndexed',
          environment: [],
          field: ['project_id', 'transaction.id', 'span.description'],
          per_page: 1,
          project: [],
          query: 'span.group:1756baf8fd19c116',
          referrer: 'api.starfish.span-description',
          statsPeriod: '10d',
        },
      })
    );

    // EPM Chart
    expect(eventsStatsRequestMock).toHaveBeenNthCalledWith(
      1,
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
          query: 'span.group:1756baf8fd19c116',
          referrer: 'api.starfish.span-summary-page-metrics-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'epm()',
          transformAliasToInputFormat: '1',
        },
      })
    );

    // Duration Chart
    expect(eventsStatsRequestMock).toHaveBeenNthCalledWith(
      2,
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
          query: 'span.group:1756baf8fd19c116',
          referrer: 'api.starfish.span-summary-page-metrics-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'avg(span.self_time)',
          transformAliasToInputFormat: '1',
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
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'transaction',
            'transaction.method',
            'epm()',
            'sum(span.self_time)',
            'avg(span.self_time)',
            'time_spent_percentage()',
            'http_response_count(5)',
          ],
          per_page: 25,
          cursor: '0:25:0',
          project: [],
          query: 'span.group:1756baf8fd19c116',
          sort: '-time_spent_percentage()',
          referrer: 'api.starfish.span-transaction-metrics',
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

    // Span details for query source. This runs after the indexed span has loaded
    expect(eventsRequestMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansIndexed',
          environment: [],
          field: ['timestamp', 'transaction.id', 'project', 'span_id', 'span.self_time'],
          per_page: 1,
          project: [],
          query: 'span.group:1756baf8fd19c116',
          sort: '-span.self_time',
          referrer: 'api.starfish.full-span-from-trace',
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
