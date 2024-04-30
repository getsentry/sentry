import {
  render,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
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

    it('should show span IDs by default', async () => {
      const container = render(
        <SampleTable
          groupId="groupId123"
          transactionMethod="GET"
          transactionName="/endpoint"
        />
      );

      await waitFor(() =>
        expect(container.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      );

      expect(container.queryAllByTestId('grid-head-cell')[0]).toHaveTextContent(
        'Span ID'
      );
      expect(container.queryAllByTestId('grid-body-cell')[0]).toHaveTextContent(
        'span-id123'
      );
    });

    it('should show transaction IDs instead of span IDs when in columnOrder', async () => {
      const container = render(
        <SampleTable
          groupId="groupId123"
          transactionMethod="GET"
          transactionName="/endpoint"
          columnOrder={[
            {
              key: 'transaction_id',
              name: t('Event ID'),
              width: COL_WIDTH_UNDEFINED,
            },
            {
              key: 'profile_id',
              name: t('Profile'),
              width: COL_WIDTH_UNDEFINED,
            },
            {
              key: 'avg_comparison',
              name: t('Compared to Average'),
              width: COL_WIDTH_UNDEFINED,
            },
          ]}
        />
      );

      await waitFor(() =>
        expect(container.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      );

      expect(container.queryAllByTestId('grid-head-cell')[0]).toHaveTextContent(
        'Event ID'
      );
      expect(container.queryAllByTestId('grid-body-cell')[0]).toHaveTextContent(
        'transaction-id123'.slice(0, 8)
      );
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
