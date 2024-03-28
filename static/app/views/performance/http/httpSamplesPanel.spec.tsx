import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {HTTPSamplesPanel} from 'sentry/views/performance/http/httpSamplesPanel';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');
jest.mock('sentry/utils/useOrganization');

describe('HTTPSamplesPanel', () => {
  const organization = OrganizationFixture();

  let ribbonRequestMock;

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

  beforeEach(() => {
    jest.clearAllMocks();

    ribbonRequestMock = MockApiClient.addMockResponse({
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
            'project.id': 1,
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
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  describe('status panel', () => {
    let chartRequestMock;

    beforeEach(() => {
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

      chartRequestMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        method: 'GET',

        match: [
          MockApiClient.matchQuery({
            referrer: 'api.starfish.http-module-samples-panel-response-bar-chart',
          }),
        ],
        body: {},
      });
    });

    it('fetches panel data', async () => {
      render(<HTTPSamplesPanel />);

      expect(ribbonRequestMock).toHaveBeenNthCalledWith(
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
              'span.module:http span.domain:"\\*.sentry.dev" transaction:/api/0/users',
            referrer: 'api.starfish.http-module-samples-panel-metrics-ribbon',
            statsPeriod: '10d',
          },
        })
      );

      expect(chartRequestMock).toHaveBeenNthCalledWith(
        1,
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
            query:
              'span.module:http span.domain:"\\*.sentry.dev" transaction:/api/0/users',
            referrer: 'api.starfish.http-module-samples-panel-response-bar-chart',
            statsPeriod: '10d',
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
    let chartRequestMock, samplesRequestMock;

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
            referrer: 'api.starfish.http-module-samples-panel-duration-chart',
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
              'span.module:http span.domain:"\\*.sentry.dev" transaction:/api/0/users',
            referrer: 'api.starfish.http-module-samples-panel-duration-chart',
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
              'span.module:http span.domain:"\\*.sentry.dev" transaction:/api/0/users',
            project: [],
            additionalFields: ['transaction.id', 'span.description', 'span.status_code'],
            lowerBound: 0,
            firstBound: expect.closeTo(333.3333),
            secondBound: expect.closeTo(666.6666),
            upperBound: 1000,
            referrer: 'api.starfish.http-module-samples-panel-samples',
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

      expect(screen.getByRole('columnheader', {name: 'Event ID'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Status'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'URL'})).toBeInTheDocument();

      expect(screen.getByRole('cell', {name: '11c910c9'})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: '11c910c9'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/performance/javascript:11c910c9c10b3ec4ecf8f209b8c6ce48#span-b1bf1acde131623a'
      );
      expect(screen.getByRole('cell', {name: '200'})).toBeInTheDocument();
    });
  });
});
