import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {DurationUnit} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {HTTPSamplesPanel} from 'sentry/views/insights/http/components/httpSamplesPanel';
import {SpanFields} from 'sentry/views/insights/types';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('HTTPSamplesPanel', () => {
  const organization = OrganizationFixture();

  let eventsRequestMock: jest.Mock;

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

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    eventsRequestMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.insights.http.samples-panel-metrics-ribbon',
        }),
      ],
      body: {
        data: [
          {
            'project.id': 1,
            'transaction.span_id': '',
            'epm()': 22.18,
            'http_response_rate(3)': 0.01,
            'http_response_rate(4)': 0.025,
            'http_response_rate(5)': 0.015,
            'avg(span.self_time)': 140.2,
            'sum(span.self_time)': 2709238,
          },
        ],
        meta: {
          fields: {
            'epm()': 'rate',
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

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      body: [],
    });
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('Status panel', () => {
    let eventsStatsRequestMock: jest.Mock;
    let samplesRequestMock: jest.Mock;

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
        url: `/organizations/${organization.slug}/events-timeseries/`,
        method: 'GET',
        match: [
          MockApiClient.matchQuery({
            referrer: 'api.insights.http.samples-panel-response-code-chart',
          }),
        ],
        body: {
          timeSeries: [
            TimeSeriesFixture({
              yAxis: `epm()`,
              groupBy: [{key: SpanFields.SPAN_STATUS_CODE, value: '301'}],
              values: [
                {timestamp: 1699907700000, value: 7810.2},
                {timestamp: 1699908000000, value: 1216.8},
              ],
            }),
            TimeSeriesFixture({
              yAxis: `epm()`,
              groupBy: [{key: SpanFields.SPAN_STATUS_CODE, value: '304'}],
              values: [
                {timestamp: 1699907700000, value: 2701.5},
                {timestamp: 1699908000000, value: 78.12},
              ],
            }),
          ],
        },
      });

      samplesRequestMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        method: 'GET',
        match: [
          MockApiClient.matchQuery({
            referrer: 'api.insights.http.samples-panel-response-code-samples',
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
              'transaction.span_id': '11c910c9c10b3ec4ecf8f209b8c6ce48',
              'span.self_time': 320.300102,
            },
          ],
          meta: {},
        },
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
            dataset: 'spans',
            environment: [],
            field: [
              'epm()',
              'avg(span.self_time)',
              'sum(span.self_time)',
              'http_response_rate(3)',
              'http_response_rate(4)',
              'http_response_rate(5)',
            ],
            per_page: 50,
            project: [],
            query: 'span.op:http.client !has:span.domain transaction:/api/0/users',
            referrer: 'api.insights.http.samples-panel-metrics-ribbon',
            sampling: SAMPLING_MODE.NORMAL,
            statsPeriod: '10d',
          },
        })
      );

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
            groupBy: [SpanFields.SPAN_STATUS_CODE],
            interval: '30m',
            sort: '-count()',
            partial: 1,
            project: [],
            query:
              'span.op:http.client !has:span.domain transaction:/api/0/users span.status_code:[300,301,302,303,304,305,307,308]',
            referrer: 'api.insights.http.samples-panel-response-code-chart',
            statsPeriod: '10d',
            topEvents: 5,
            yAxis: ['count()'],
            caseInsensitive: undefined,
          },
        })
      );

      expect(samplesRequestMock).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            dataset: 'spans',
            sampling: SAMPLING_MODE.NORMAL,
            query:
              'span.op:http.client !has:span.domain transaction:/api/0/users span.status_code:[300,301,302,303,304,305,307,308]',
            project: [],
            field: [
              'project',
              'trace',
              'transaction.span_id',
              'span_id',
              'timestamp',
              'span.description',
              'span.status_code',
            ],
            sort: '-span_id',
            referrer: 'api.insights.http.samples-panel-response-code-samples',
            statsPeriod: '10d',
          }),
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
        url: `/organizations/${organization.slug}/events-timeseries/`,
        method: 'GET',
        match: [
          MockApiClient.matchQuery({
            referrer: 'api.insights.http.samples-panel-duration-chart',
          }),
        ],
        body: {
          timeSeries: [
            TimeSeriesFixture({
              yAxis: 'avg(span.self_time)',
              meta: {
                valueType: 'duration',
                valueUnit: DurationUnit.MILLISECOND,
                interval: 1_800_000,
              },
              values: [{timestamp: 1711393200000, value: 900}],
            }),
          ],
        },
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
              'transaction.span_id': '11c910c9c10b3ec4ecf8f209b8c6ce48',
              'span.self_time': 320.300102,
            },
          ],
          meta: {
            fields: {},
            units: {},
          },
        },
      });
    });

    it('fetches panel data', async () => {
      render(<HTTPSamplesPanel />);

      await waitForElementToBeRemoved(() => screen.queryAllByTestId('loading-indicator'));

      expect(chartRequestMock).toHaveBeenNthCalledWith(
        1,
        `/organizations/${organization.slug}/events-timeseries/`,
        expect.objectContaining({
          method: 'GET',
          query: expect.objectContaining({
            dataset: 'spans',
            sampling: SAMPLING_MODE.NORMAL,
            environment: [],
            interval: '30m',
            excludeOther: 0,
            groupBy: undefined,
            sort: undefined,
            topEvents: undefined,
            partial: 1,
            project: [],
            query:
              'span.op:http.client span.domain:"\\*.sentry.dev" transaction:/api/0/users',
            referrer: 'api.insights.http.samples-panel-duration-chart',
            statsPeriod: '10d',
            yAxis: ['avg(span.self_time)'],
            caseInsensitive: undefined,
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
              'span.op:http.client span.domain:"\\*.sentry.dev" transaction:/api/0/users',
            project: [],
            additionalFields: [
              'id',
              'trace',
              'span.description',
              'span.status_code',
              'transaction.span_id',
            ],
            lowerBound: 0,
            firstBound: expect.closeTo(333.3333),
            secondBound: expect.closeTo(666.6666),
            upperBound: 1000,
            referrer: 'api.insights.http.samples-panel-duration-samples',
            statsPeriod: '10d',
          }),
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
        '/organizations/org-slug/explore/traces/trace/2b60b2eb415c4bfba3efeaf65c21c605/?domain=%2A.sentry.dev&eventId=11c910c9c10b3ec4ecf8f209b8c6ce48&node=span-b1bf1acde131623a&node=txn-11c910c9c10b3ec4ecf8f209b8c6ce48&panel=duration&source=requests_module&statsPeriod=10d&timestamp=1711398696&transaction=%2Fapi%2F0%2Fusers&transactionMethod=GET'
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
