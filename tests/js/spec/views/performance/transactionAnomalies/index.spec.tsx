import {
  initializeData as _initializeData,
  initializeDataSettings,
} from 'sentry-test/performance/initializePerformanceData';
import {act, cleanup, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TransactionAnomalies from 'sentry/views/performance/transactionSummary/transactionAnomalies';

const initializeData = (settings: initializeDataSettings) => {
  const data = _initializeData(settings);

  act(() => void ProjectsStore.loadInitialData(data.organization.projects));
  return data;
};

describe('AnomaliesTab', function () {
  let anomaliesMock: any;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sdk-updates/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-has-measurements/',
      body: {measurements: false},
    });
    anomaliesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/transaction-anomaly-detection/',
      body: {},
    });
  });
  afterEach(cleanup);
  it('renders basic UI elements with flag', async function () {
    const initialData = initializeData({
      features: ['performance-view', 'performance-anomaly-detection-ui'],
      query: {project: '1', transaction: 'transaction'},
    });

    mountWithTheme(<TransactionAnomalies location={initialData.router.location} />, {
      context: initialData.routerContext,
      organization: initialData.organization,
    });

    expect(await screen.findByText('Transaction Count')).toBeInTheDocument();

    expect(anomaliesMock).toHaveBeenCalledTimes(1);

    expect(anomaliesMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          field: ['tpm()'],
          per_page: 50,
          project: ['1'],
          query: 'transaction:transaction',
          statsPeriod: '14d',
        }),
      })
    );
  });
});
