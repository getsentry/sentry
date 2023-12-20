import {
  render,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {PageFilters} from 'sentry/types';
import {SpanMetricsField} from 'sentry/views/starfish/types';

import SampleTable from './sampleTable';

const DEFAULT_SELECTION: PageFilters = {
  datetime: {
    period: '14d',
    start: null,
    end: null,
    utc: false,
  },
  environments: [],
  projects: [],
};

jest.mock('sentry/utils/usePageFilters', () => {
  return {
    __esModule: true,
    default: () => ({isReady: true, selection: DEFAULT_SELECTION}),
  };
});

describe('SampleTable', function () {
  beforeEach(() => {
    initializeMockRequests();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('When all data is available', () => {
    it('should finsh loading', async () => {
      const container = render(
        <SampleTable
          groupId="groupId123"
          transactionMethod="GET"
          transactionName="/endpoint"
        />
      );

      await waitForElementToBeRemoved(() => container.queryByTestId('loading-indicator'));
    });

    it('should never show no results', async () => {
      const container = render(
        <SampleTable
          groupId="groupId123"
          transactionMethod="GET"
          transactionName="/endpoint"
        />
      );

      await expectNever(() => container.getByText('No results found for your query'));
      expect(container.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  describe('When there is missing data', () => {
    it('should display no query results', async () => {
      MockApiClient.addMockResponse({
        url: '/api/0/organizations/org-slug/spans-samples/?firstBound=0.6666666666666666&lowerBound=0&query=span.group%3AgroupId123%20transaction%3A%2Fendpoint%20transaction.method%3AGET&secondBound=1.3333333333333333&statsPeriod=14d&upperBound=2',
        method: 'GET',
        body: {
          data: [],
        },
      });

      const container = render(
        <SampleTable
          groupId="groupId123"
          transactionMethod="GET"
          transactionName="/endpoint"
        />
      );
      await waitForElementToBeRemoved(() => container.queryByTestId('loading-indicator'));
      expect(
        container.queryByText('No results found for your query')
      ).toBeInTheDocument();
    });
  });
});

const initializeMockRequests = () => {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/`,
    body: {
      data: [
        {
          [SpanMetricsField.SPAN_OP]: 'db',
          [`avg(${SpanMetricsField.SPAN_SELF_TIME})`]: 0.52,
        },
      ],
    },
    match: [
      (_, options) => {
        const match =
          options.query?.referrer === 'api.starfish.span-summary-panel-samples-table-avg';
        return match;
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/events/`,
    body: {
      data: [
        {
          id: 'transaction-id123',
          'transaction.duration': 147,
          'project.name': 'sentry',
          timestamp: '2023-05-21T19:30:06+00:00',
        },
      ],
    },
    match: [
      (_, options) => {
        const match =
          options.query?.referrer ===
          'api.starfish.span-summary-panel-samples-table-transactions';
        return match;
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-stats/',
    body: {
      data: [
        [1689710400, [{count: 1.5}]],
        [1689714000, [{count: 1.65}]],
      ],
      end: 1690315200,
      start: 1689710400,
    },
    match: [
      (_, options) => {
        const {query} = options;
        return (
          query?.referrer === 'api.starfish.sidebar-span-metrics' &&
          query?.yAxis === 'avg(span.self_time)'
        );
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: '/api/0/organizations/org-slug/spans-samples/?firstBound=0.6666666666666666&lowerBound=0&query=span.group%3AgroupId123%20transaction%3A%2Fendpoint%20transaction.method%3AGET&secondBound=1.3333333333333333&statsPeriod=14d&upperBound=2',
    method: 'GET',
    body: {
      data: [
        {
          project: 'sentry',
          'span.self_time': 1.5,
          timestamp: '2023-05-21T19:30:06+00:00',
          span_id: 'span-id123',
          'transaction.id': 'transaction-id123',
        },
      ],
    },
  });
};

async function expectNever(callable: () => unknown): Promise<void> {
  await expect(() => waitFor(callable)).rejects.toEqual(expect.anything());
}
