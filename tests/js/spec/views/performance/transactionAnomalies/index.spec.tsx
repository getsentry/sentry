import {
  initializeData as _initializeData,
  initializeDataSettings,
} from 'sentry-test/performance/initializePerformanceData';
import {act, cleanup, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import TransactionAnomalies from 'sentry/views/performance/transactionSummary/transactionAnomalies';

const initializeData = (settings: initializeDataSettings) => {
  const data = _initializeData(settings);

  act(() => void ProjectsStore.loadInitialData(data.organization.projects));
  return data;
};

const WrappedComponent = data => {
  return (
    <OrganizationContext.Provider value={data.organization}>
      <TransactionAnomalies {...data} />,
    </OrganizationContext.Provider>
  );
};

describe('AnomaliesTab', function () {
  afterEach(cleanup);
  it('renders basic UI elements with flag', async function () {
    const initialData = initializeData({
      features: ['performance-view', 'performance-anomaly-detection-ui'],
      query: {project: '1', transaction: 'transaction'},
    });
    mountWithTheme(
      <WrappedComponent
        organization={initialData.organization}
        location={initialData.router.location}
      />,
      {context: initialData.routerContext}
    );

    expect(await screen.findByText('Transaction Count')).toBeInTheDocument();
  });
});
