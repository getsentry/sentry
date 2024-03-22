import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HTTPSamplesPanel} from 'sentry/views/performance/http/httpSamplesPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('HTTPSamplesPanel', function () {
  const organization = OrganizationFixture();
  let eventsRequestMock;

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
    query: {
      domain: '*.sentry.dev',
      statsPeriod: '10d',
      transaction: '/api/0/users',
      transactionMethod: 'GET',
      panel: 'status',
    },
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  jest.mocked(useOrganization).mockReturnValue(organization);

  beforeEach(function () {
    eventsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
      },
    });
  });

  afterAll(function () {
    jest.resetAllMocks();
  });

  it('fetches panel data', async function () {
    render(<HTTPSamplesPanel />);

    expect(eventsRequestMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: [
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
          query: 'span.module:http span.domain:"\\*.sentry.dev" transaction:/api/0/users',
          referrer: 'api.starfish.http-module-samples-panel-metrics-ribbon',
          statsPeriod: '10d',
        },
      })
    );

    expect(eventsRequestMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        method: 'GET',
        query: {
          dataset: 'spansMetrics',
          environment: [],
          field: ['span.status_code', 'count()'],
          per_page: 50,
          sort: 'span.status_code',
          project: [],
          query: 'span.module:http span.domain:"\\*.sentry.dev" transaction:/api/0/users',
          referrer: 'api.starfish.http-module-samples-panel-response-bar-chart',
          statsPeriod: '10d',
        },
      })
    );

    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
  });

  it('show basic transaction info', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',

      match: [
        MockApiClient.matchQuery({
          referrer: 'api.starfish.http-module-samples-panel-metrics-ribbon',
        }),
      ],
      body: {
        data: [
          {
            'spm()': 22.18,
            'http_response_rate(3)': 0.01,
            'http_response_rate(4)': 0.025,
            'http_response_rate(5)': 0.015,
            'avg(span.self_time)': 140.2,
            'sum(span.self_time)': 2709238,
          },
        ],
        meta: {
          fields: {
            'spm()': 'rate',
            'avg(span.self_time)': 'duration',
            'http_response_rate(3)': 'percentage',
            'http_response_rate(4)': 'percentage',
            'http_response_rate(5)': 'percentage',
            'sum(span.self_time)': 'duration',
          },
        },
      },
    });

    render(<HTTPSamplesPanel />);

    // Panel heading
    expect(screen.getByRole('heading', {name: 'GET /api/0/users'})).toBeInTheDocument();

    // Metrics ribbon
    await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

    expect(
      screen.getByRole('heading', {name: 'Requests Per Minute'})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Avg Duration'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: '3XXs'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: '4XXs'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: '5XXs'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Time Spent'})).toBeInTheDocument();

    expect(screen.getByText('22.2/min')).toBeInTheDocument();
    expect(screen.getByText('140.20ms')).toBeInTheDocument();
    expect(screen.getByText('1%')).toBeInTheDocument();
    expect(screen.getByText('2.5%')).toBeInTheDocument();
    expect(screen.getByText('1.5%')).toBeInTheDocument();
    expect(screen.getByText('45.15min')).toBeInTheDocument();
  });
});
