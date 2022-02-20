import {
  initializeData as _initializeData,
  initializeDataSettings,
} from 'sentry-test/performance/initializePerformanceData';
import {act, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TransactionAnomalies from 'sentry/views/performance/transactionSummary/transactionAnomalies';

const initializeData = (settings: initializeDataSettings) => {
  const data = _initializeData(settings);

  act(() => void ProjectsStore.loadInitialData(data.organization.projects));
  return data;
};

describe('AnomaliesTab', function () {
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
  });
});
