import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import SpanMetricsTable from 'sentry/views/performance/transactionSummary/transactionSpans/spanMetricsTable';

const initializeData = () => {
  const data = _initializeData({
    features: ['performance-view'],
  });

  act(() => ProjectsStore.loadInitialData(data.organization.projects));
  return data;
};

describe('SuspectSpansTable', () => {
  it('should render the table and rows of data', async () => {
    const initialData = initializeData();
    const {organization, project, routerContext} = initialData;

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            'span.group': '',
            'span.op': 'navigation',
            'span.description': '',
            'spm()': 4.448963396488444,
            'sum(span.self_time)': 1236071121.5044901,
            'avg(span.duration)': 30900.700924083318,
          },
          {
            'span.group': 'ba978f0360ad3048',
            'span.op': 'http.client',
            'span.description': 'GET https://*.sentry.io',
            'spm()': 53.88840392818173,
            'sum(span.self_time)': 414527976.008568,
            'avg(span.duration)': 763.0284500928477,
          },
        ],
      },
    });

    render(<SpanMetricsTable transactionName="Test Transaction" project={project} />, {
      context: routerContext,
    });

    await waitFor(() =>
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    );

    expect(mockRequest).toHaveBeenCalled();

    const tableHeaders = await screen.findAllByTestId('grid-head-cell');
    const [opHeader, nameHeader, throughputHeader, avgDurationHeader, timeSpentHeader] =
      tableHeaders;

    expect(opHeader).toHaveTextContent('Span Operation');
    expect(nameHeader).toHaveTextContent('Span Name');
    expect(throughputHeader).toHaveTextContent('Throughput');
    expect(avgDurationHeader).toHaveTextContent('Avg Duration');
    expect(timeSpentHeader).toHaveTextContent('Time Spent');
  });
});
