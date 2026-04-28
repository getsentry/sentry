import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EAPSidebarCharts} from './eapSidebarCharts';

describe('EAPSidebarCharts', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            yAxis: 'failure_rate()',
            values: [{timestamp: 1000000, value: 0.05}],
            meta: {interval: 3600, valueType: 'percentage', valueUnit: null},
          },
        ],
      },
    });
  });

  it('renders Performance Score widget when hasWebVitals is true', async () => {
    render(<EAPSidebarCharts transactionName="test-txn" hasWebVitals />);
    expect(await screen.findByText('Performance Score')).toBeInTheDocument();
    expect(await screen.findByText('Failure Rate')).toBeInTheDocument();
  });

  it('does not render Performance Score widget when hasWebVitals is false', async () => {
    render(<EAPSidebarCharts transactionName="test-txn" hasWebVitals={false} />);
    expect(await screen.findByText('Failure Rate')).toBeInTheDocument();
    expect(screen.queryByText('Performance Score')).not.toBeInTheDocument();
  });

  it('renders performance score wheel widget', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'performance_score(measurements.score.lcp)': 0.89,
            'performance_score(measurements.score.fcp)': 0.92,
            'performance_score(measurements.score.inp)': 0.75,
            'performance_score(measurements.score.cls)': 0.95,
            'performance_score(measurements.score.ttfb)': 0.88,
            'performance_score(measurements.score.total)': 0.87,
            'count_scores(measurements.score.total)': 100,
            'count_scores(measurements.score.lcp)': 100,
            'count_scores(measurements.score.fcp)': 100,
            'count_scores(measurements.score.inp)': 100,
            'count_scores(measurements.score.cls)': 100,
            'count_scores(measurements.score.ttfb)': 100,
          },
        ],
      },
      match: [
        (_url: string, options: Record<string, any>) =>
          Array.isArray(options.query?.field) &&
          options.query.field.includes('performance_score(measurements.score.total)'),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [{'failure_rate()': 0.05}],
      },
      match: [
        (_url: string, options: Record<string, any>) =>
          Array.isArray(options.query?.field) &&
          options.query.field.includes('failure_rate()'),
      ],
    });

    render(<EAPSidebarCharts transactionName="test-txn" hasWebVitals />);

    // The wheel widget renders with the total score (0.87 * 100 = 87)
    expect(await screen.findByText('87')).toBeInTheDocument();
  });
});
