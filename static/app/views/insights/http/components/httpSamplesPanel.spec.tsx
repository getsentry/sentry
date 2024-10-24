import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HTTPSamplesPanel} from 'sentry/views/insights/http/components/httpSamplesPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('HTTPSamplesPanel', () => {
  const organization = OrganizationFixture();

  let eventsRequestMock: jest.Mock;

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

  beforeEach(() => {
    jest.clearAllMocks();

    eventsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.performance.http.samples-panel-metrics-ribbon',
        }),
      ],
      body: {
        data: [
          {
            'project.id': 1,
            'transaction.id': '',
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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('Status panel', () => {
    let eventsStatsRequestMock: jest.Mock;
    let samplesRequestMock: jest.Mock;
    let spanFieldTagsMock: jest.Mock;

    beforeEach(() => {
      jest.mocked(useLocation).mockReturnValue({
        pathname: '',
        search: '',
        query: {
          statsPeriod: '10d',
          transaction: '/api/0/users',
          transactionMethod: 'GET',
          panel: 'status',
          responseCodeClass: '3',
        },
        hash: '',
        state: undefined,
        action: 'PUSH',
        key: '',
      });

      eventsStatsRequestMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
        method: 'GET',
        match: [
          MockApiClient.matchQuery({
            referrer: 'api.performance.http.samples-panel-response-code-chart',
          }),
        ],
        body: {
          '301': {
            data: [
              [1699907700, [{count: 7810.2}]],
              [1699908000, [{count: 1216.8}]],
            ],
          },
          '304': {
            data: [
              [1699907700, [{count: 2701.5}]],
              [1699908000, [{count: 78.12}]],
            ],
          },
        },
      });

      samplesRequestMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        method: 'GET',
        match: [
          MockApiClient.matchQuery({
            referrer: 'api.performance.http.samples-panel-response-code-samples',
          }),
        ],
        body: {
          data: [
            {
              span_id: 'b1bf1acde131623a',
              trace: '2b60b2eb415c4bfba3efeaf65c21c605',
              'span.description':
                'GET https://sentry.io/api/0/organizations/sentry/info/?projectId=1',
              project: 'javascript',
              timestamp: '2024-03-25T20:31:36+00:00',
              'span.status_code': '200',
              'transaction.id': '11c910c9c10b3ec4ecf8f209b8c6ce48',
              'span.self_time': 320.300102,
            },
          ],
          meta: {},
        },
      });

      spanFieldTagsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/spans/fields/`,
        method: 'GET',
        body: [
          {
            key: 'api_key',
            name: 'Api Key',
          },
          {
            key: 'bytes.size',
            name: 'Bytes.Size',
          },
        ],
      });
    });

    it('fetches panel data', async () => {
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
            query:
              'span.module:http span.op:http.client !has:span.domain transaction:/api/0/users',
            referrer: 'api.performance.http.samples-panel-metrics-ribbon',
            statsPeriod: '10d',
          },
        })
      );

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
            field: ['span.status_code', 'count()'],
            interval: '30m',
            orderby: '-count()',
            partial: 1,
            per_page: 50,
            project: [],
            query:
              'span.module:http span.op:http.client !has:span.domain transaction:/api/0/users span.status_code:[300,301,302,303,304,305,307,308]',
            referrer: 'api.performance.http.samples-panel-response-code-chart',
            statsPeriod: '10d',
            sort: '-count()',
            topEvents: '5',
            yAxis: 'count()',
          },
        })
      );

      expect(samplesRequestMock).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            dataset: 'spansIndexed',
            query:
              'span.module:http span.op:http.client !has:span.domain transaction:/api/0/users span.status_code:[300,301,302,303,304,305,307,308]',
            project: [],
            field: [
              'project',
              'trace',
              'transaction.id',
              'span_id',
              'timestamp',
              'span.description',
              'span.status_code',
            ],
            sort: '-span_id',
            referrer: 'api.performance.http.samples-panel-response-code-samples',
            statsPeriod: '10d',
          }),
        })
      );

      expect(spanFieldTagsMock).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/spans/fields/`,
        expect.objectContaining({
          method: 'GET',
          query: {
            project: [],
            environment: [],
            statsPeriod: '1h',
          },
        })
      );

      await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));
    });

    it('shows basic transaction info', async () => {
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

  describe('Duration panel', () => {
    let chartRequestMock: jest.Mock;
    let samplesRequestMock: jest.Mock;
    let spanFieldTagsMock: jest.Mock;

    beforeEach(() => {
      jest.mocked(useLocation).mockReturnValue({
        pathname: '',
        search: '',
        query: {
          domain: '*.sentry.dev',
          statsPeriod: '10d',
          transaction: '/api/0/users',
          transactionMethod: 'GET',
          panel: 'duration',
        },
        hash: '',
        state: undefined,
        action: 'PUSH',
        key: '',
      });

      chartRequestMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-stats/`,
        method: 'GET',
        match: [
          MockApiClient.matchQuery({
            referrer: 'api.performance.http.samples-panel-duration-chart',
          }),
        ],
        body: {data: [[1711393200, [{count: 900}]]]},
      });

      samplesRequestMock = MockApiClient.addMockResponse({
        url: `/api/0/organizations/${organization.slug}/spans-samples/`,
        method: 'GET',
        body: {
          data: [
            {
              span_id: 'b1bf1acde131623a',
              trace: '2b60b2eb415c4bfba3efeaf65c21c605',
              'span.description':
                'GET https://sentry.io/api/0/organizations/sentry/info/?projectId=1',
              project: 'javascript',
              timestamp: '2024-03-25T20:31:36+00:00',
              'span.status_code': '200',
              'transaction.id': '11c910c9c10b3ec4ecf8f209b8c6ce48',
              'span.self_time': 320.300102,
            },
          ],
        },
      });

      spanFieldTagsMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/spans/fields/`,
        method: 'GET',
        body: [
          {
            key: 'api_key',
            name: 'Api Key',
          },
          {
            key: 'bytes.size',
            name: 'Bytes.Size',
          },
        ],
      });
    });

    it('fetches panel data', async () => {
      render(<HTTPSamplesPanel />);

      await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

      expect(chartRequestMock).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/events-stats/`,
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            dataset: 'spansMetrics',
            environment: [],
            interval: '30m',
            per_page: 50,
            project: [],
            query:
              'span.module:http span.op:http.client span.domain:"\\*.sentry.dev" transaction:/api/0/users',
            referrer: 'api.performance.http.samples-panel-duration-chart',
            statsPeriod: '10d',
            yAxis: 'avg(span.self_time)',
          }),
        })
      );

      expect(samplesRequestMock).toHaveBeenNthCalledWith(
        1,
        `/api/0/organizations/${organization.slug}/spans-samples/`,
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            query:
              'span.module:http span.op:http.client span.domain:"\\*.sentry.dev" transaction:/api/0/users',
            project: [],
            additionalFields: [
              'trace',
              'transaction.id',
              'span.description',
              'span.status_code',
            ],
            lowerBound: 0,
            firstBound: expect.closeTo(333.3333),
            secondBound: expect.closeTo(666.6666),
            upperBound: 1000,
            referrer: 'api.performance.http.samples-panel-duration-samples',
            statsPeriod: '10d',
          }),
        })
      );

      expect(spanFieldTagsMock).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/spans/fields/`,
        expect.objectContaining({
          method: 'GET',
          query: {
            project: [],
            environment: [],
            statsPeriod: '1h',
          },
        })
      );
    });

    it('show basic transaction info', async () => {
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

      // Samples table
      expect(screen.getByRole('table', {name: 'Span Samples'})).toBeInTheDocument();

      expect(screen.getByRole('columnheader', {name: 'Span ID'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Status'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'URL'})).toBeInTheDocument();

      expect(screen.getByRole('cell', {name: 'b1bf1acde131623a'})).toBeInTheDocument();

      expect(screen.getByRole('link', {name: 'b1bf1acde131623a'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/performance/javascript:11c910c9c10b3ec4ecf8f209b8c6ce48/?domain=%2A.sentry.dev&panel=duration&statsPeriod=10d&transactionMethod=GET#span-b1bf1acde131623a'
      );

      expect(screen.getByRole('cell', {name: '200'})).toBeInTheDocument();
    });

    it('re-fetches samples', async () => {
      render(<HTTPSamplesPanel />);

      await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

      expect(samplesRequestMock).toHaveBeenCalledTimes(1);

      await userEvent.click(screen.getByRole('button', {name: 'Try Different Samples'}));

      expect(samplesRequestMock).toHaveBeenCalledTimes(2);
    });
  });
});
