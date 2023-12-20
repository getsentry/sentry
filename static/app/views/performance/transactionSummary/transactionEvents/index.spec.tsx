import {browserHistory} from 'react-router';

import {
  initializeData as _initializeData,
  InitializeDataSettings,
} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import TransactionEvents from 'sentry/views/performance/transactionSummary/transactionEvents';

import {EVENTS_TABLE_RESPONSE_FIELDS, MOCK_EVENTS_TABLE_DATA} from './eventsTable.spec';

function WrappedComponent({data}) {
  return (
    <MEPSettingProvider>
      <TransactionEvents
        organization={data.organization}
        location={data.router.location}
      />
    </MEPSettingProvider>
  );
}

const setupMockApiResponeses = () => {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-has-measurements/',
    body: {measurements: false},
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: [
        {
          'p100()': 9500,
          'p99()': 9000,
          'p95()': 7000,
          'p75()': 5000,
          'p50()': 500,
        },
      ],
      meta: {
        fields: {
          'p100()': 'duration',
          'p99()': 'duration',
          'p95()': 'duration',
          'p75()': 'duration',
          'p50()': 'duration',
        },
      },
    },
    match: [
      (_, options) => {
        return options.query?.field?.includes('p95()');
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: [
        {
          'count()': 4000,
        },
      ],
      meta: {
        fields: {
          'count()': 'integer',
        },
      },
    },
    match: [
      (_, options) => {
        return options.query?.field?.includes('count()');
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: [
        {
          'count()': 4000,
        },
      ],
      meta: {
        fields: {
          'count()': 'integer',
        },
      },
    },
    match: [(_, options) => options.query?.field?.includes('count()')],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: MOCK_EVENTS_TABLE_DATA,
      meta: {
        fields: EVENTS_TABLE_RESPONSE_FIELDS,
      },
    },
    match: [
      (_, options) =>
        options.query?.field?.includes('transaction.duration') &&
        !options.query?.query.includes('transaction.duration'),
    ],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    body: {
      data: [MOCK_EVENTS_TABLE_DATA[0]],
      meta: {
        fields: EVENTS_TABLE_RESPONSE_FIELDS,
      },
    },
    match: [
      (_, options) =>
        options.query?.field?.includes('transaction.duration') &&
        options.query?.query.includes('transaction.duration:<=500'), // 500 refers to p50 value
    ],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/replay-count/',
    body: {},
  });
};

const initializeData = (settings?: InitializeDataSettings) => {
  settings = {
    features: ['performance-view'],
    query: {project: '1', transaction: 'transaction'},
    ...settings,
  };
  const data = _initializeData(settings);
  act(() => void ProjectsStore.loadInitialData(data.organization.projects));
  return data;
};

describe('Performance > Transaction Summary > Transaction Events > Index', () => {
  beforeEach(setupMockApiResponeses);
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('should contain all transaction events', async () => {
    const data = initializeData();

    render(<WrappedComponent data={data} />, {context: data.routerContext});
    expect(await screen.findByText('uhoh@example.com')).toBeInTheDocument();
    expect(await screen.findByText('moreuhoh@example.com')).toBeInTheDocument();
  });

  it('should filter the transaction duration if in query', async () => {
    const data = initializeData({
      query: {project: '1', transaction: 'transaction', showTransactions: 'p50'},
    });

    render(<WrappedComponent data={data} />, {context: data.routerContext});
    expect(await screen.findByText('uhoh@example.com')).toBeInTheDocument();
    expect(screen.queryByText('moreuhoh@example.com')).not.toBeInTheDocument();
  });

  it('should update transaction percentile query if selected', async () => {
    const data = initializeData();

    render(<WrappedComponent data={data} />, {context: data.routerContext});
    const percentileButton = await screen.findByRole('button', {
      name: /percentile p100/i,
    });

    await userEvent.click(percentileButton);

    const p50 = screen.getByRole('option', {name: 'p50'});
    expect(p50).toBeInTheDocument();

    await userEvent.click(p50);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({query: expect.objectContaining({showTransactions: 'p50'})})
    );
  });
});
