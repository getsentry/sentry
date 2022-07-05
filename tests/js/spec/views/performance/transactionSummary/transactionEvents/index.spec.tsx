// import {initializeData} from 'sentry-test/performance/initializePerformanceData';
import {browserHistory} from 'react-router';

import {
  initializeData as _initializeData,
  initializeDataSettings,
} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OrganizationContext} from 'sentry/views/organizationContext';
import TransactionEvents from 'sentry/views/performance/transactionSummary/transactionEvents';

import {eventsTableResponseFields, mockEventsTableData} from './eventsTable.spec';

const WrappedComponent = ({data}) => {
  return (
    <OrganizationContext.Provider value={data.organization}>
      <MEPSettingProvider>
        <TransactionEvents
          organization={data.organization}
          location={data.router.location}
        />
      </MEPSettingProvider>
    </OrganizationContext.Provider>
  );
};

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
      data: mockEventsTableData,
      meta: {
        fields: eventsTableResponseFields,
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
      data: [mockEventsTableData[0]],
      meta: {
        fields: eventsTableResponseFields,
      },
    },
    match: [
      (_, options) =>
        options.query?.field?.includes('transaction.duration') &&
        options.query?.query.includes('transaction.duration:<=500'), // 500 refers to p50 value
    ],
  });
};

const initializeData = (settings?: initializeDataSettings) => {
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
    const percentileContainer = await screen.findByRole('presentation');
    const percentileButton = await within(percentileContainer).findByRole('button');

    userEvent.click(percentileButton);

    const p50Selection = document.querySelector('[value=p50]') as HTMLElement;

    expect(p50Selection).not.toBe(null);

    userEvent.click(p50Selection);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({query: expect.objectContaining({showTransactions: 'p50'})})
    );
  });
});
