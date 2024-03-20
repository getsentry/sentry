import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HTTPDomainSummaryPage} from 'sentry/views/performance/http/httpDomainSummaryPage';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('HTTPSummaryPage', function () {
  const organization = OrganizationFixture();

  let domainChartsRequestMock, domainTransactionsListRequestMock;

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
    query: {domain: '*.sentry.dev', statsPeriod: '10d', transactionsCursor: '0:20:0'},
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useOrganization).mockReturnValue(organization);

  beforeEach(function () {
    domainTransactionsListRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
      },
    });

    domainChartsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      method: 'GET',
      body: {
        'spm()': {
          data: [
            [1699907700, [{count: 7810.2}]],
            [1699908000, [{count: 1216.8}]],
          ],
        },
      },
    });
  });

  afterAll(function () {
    jest.resetAllMocks();
  });

  it('fetches module data', async function () {
    render(<HTTPDomainSummaryPage />);

    expect(domainChartsRequestMock).toHaveBeenNthCalledWith(
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
          query: 'span.module:http span.domain:"\\*.sentry.dev"',
          referrer: 'api.starfish.http-module-domain-summary-throughput-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'spm()',
        },
      })
    );

    expect(domainChartsRequestMock).toHaveBeenNthCalledWith(
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
          query: 'span.module:http span.domain:"\\*.sentry.dev"',
          referrer: 'api.starfish.http-module-domain-summary-duration-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: 'avg(span.self_time)',
        },
      })
    );

    expect(domainChartsRequestMock).toHaveBeenNthCalledWith(
      3,
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
          query: 'span.module:http span.domain:"\\*.sentry.dev"',
          referrer: 'api.starfish.http-module-domain-summary-response-code-chart',
          statsPeriod: '10d',
          topEvents: undefined,
          yAxis: [
            'http_response_rate(3)',
            'http_response_rate(4)',
            'http_response_rate(5)',
          ],
        },
      })
    );

    expect(domainTransactionsListRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'span.domain',
            'spm()',
            'avg(span.self_time)',
            'sum(span.self_time)',
            'http_response_rate(3)',
            'http_response_rate(4)',
            'http_response_rate(5)',
            'time_spent_percentage()',
          ],
          per_page: 50,
          project: [],
          query: 'span.module:http span.domain:"\\*.sentry.dev"',
          referrer: 'api.starfish.http-module-domain-summary-metrics-ribbon',
          statsPeriod: '10d',
        },
      })
    );

    expect(domainTransactionsListRequestMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: [
            'transaction',
            'spm()',
            'http_response_rate(2)',
            'http_response_rate(4)',
            'http_response_rate(5)',
            'avg(span.self_time)',
            'sum(span.self_time)',
            'time_spent_percentage()',
          ],
          per_page: 20,
          project: [],
          cursor: '0:20:0',
          query: 'span.module:http span.domain:"\\*.sentry.dev"',
          sort: '-time_spent_percentage()',
          referrer: 'api.starfish.http-module-domain-summary-transactions-list',
          statsPeriod: '10d',
        },
      })
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });

  it('renders a list of queries', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',

      match: [
        MockApiClient.matchQuery({
          referrer: 'api.starfish.http-module-domain-summary-transactions-list',
        }),
      ],
      body: {
        data: [
          {
            transaction: '/api/users',
            'spm()': 17.88,
            'http_response_rate(2)': 0.97,
            'http_response_rate(4)': 0.025,
            'http_response_rate(5)': 0.005,
            'avg(span.self_time)': 204.5,
            'sum(span.self_time)': 177238,
          },
        ],
        meta: {
          fields: {
            'spm()': 'rate',
            'avg(span.self_time)': 'duration',
            'http_response_rate(2)': 'percentage',
            'http_response_rate(4)': 'percentage',
            'http_response_rate(5)': 'percentage',
            'sum(span.self_time)': 'duration',
          },
        },
      },
    });

    render(<HTTPDomainSummaryPage />);

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(screen.getByRole('table', {name: 'Transactions'})).toBeInTheDocument();

    expect(screen.getByRole('columnheader', {name: 'Found In'})).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', {name: 'Requests Per Minute'})
    ).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: '2XXs'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: '4XXs'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: '5XXs'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Avg Duration'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Time Spent'})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: '/api/users'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '17.9/s'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '97%'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '2.5%'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '0.5%'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '204.50ms'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '2.95min'})).toBeInTheDocument();
  });
});
