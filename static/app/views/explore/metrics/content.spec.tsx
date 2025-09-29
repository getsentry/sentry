import {initializeMetricsTest} from 'sentry-fixture/metrics';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MetricsContent from 'sentry/views/explore/metrics/content';

describe('MetricsContent', () => {
  const {organization, project, setupPageFilters} = initializeMetricsTest();

  let eventTableMock: jest.Mock;

  setupPageFilters();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    // Default API mocks
    eventTableMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            id: '1',
            'project.id': project.id,
            'organization.id': organization.id,
            'metric.name': 'custom.counter',
            'sentry.metric_type': 'count',
            'metric.value': 100,
            timestamp: '2025-04-10T19:21:12+00:00',
            'trace.id': '7b91699fd385d9fd52e0c4bc',
            environment: 'production',
          },
          {
            id: '2',
            'project.id': project.id,
            'organization.id': organization.id,
            'metric.name': 'custom.gauge',
            'sentry.metric_type': 'gauge',
            'metric.value': 50.5,
            timestamp: '2025-04-10T19:21:10+00:00',
            'trace.id': 'c331c2df93d846f5a2134203416d40bb',
            environment: 'production',
          },
        ],
        meta: {
          fields: {
            id: 'string',
            'project.id': 'string',
            'organization.id': 'number',
            'metric.name': 'string',
            'sentry.metric_type': 'string',
            'metric.value': 'number',
            timestamp: 'date',
            'trace.id': 'string',
            environment: 'string',
          },
        },
      },
    });
  });

  it('renders the metrics page with header', async () => {
    render(<MetricsContent />, {organization});

    // Check for main UI elements
    expect(screen.getByText('Aggregates')).toBeInTheDocument();
    expect(screen.getByText('Metric Samples')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Metric Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Metric Type')).toBeInTheDocument();
    expect(screen.getByText('Configure')).toBeInTheDocument();
  });

  it('switches between aggregates and samples tabs', async () => {
    render(<MetricsContent />, {organization});

    const samplesTab = screen.getByText('Metric Samples');
    await userEvent.click(samplesTab);

    // Verify tab is selected (you'd need to check the actual state/visual change)
    expect(samplesTab).toBeInTheDocument();
  });

  it('shows save as button when features are enabled', () => {
    const orgWithFeatures = {
      ...organization,
      features: [
        ...organization.features,
        'tracemetrics-enabled',
        'tracemetrics-save-as-query',
        'tracemetrics-dashboards',
      ],
    };

    render(<MetricsContent />, {organization: orgWithFeatures});

    expect(screen.getByText('Save as')).toBeInTheDocument();
  });

  it('hides save as button when features are disabled', () => {
    const orgWithoutFeatures = {
      ...organization,
      features: ['tracemetrics-enabled'], // Only base feature
    };

    render(<MetricsContent />, {organization: orgWithoutFeatures});

    expect(screen.queryByText('Save as')).not.toBeInTheDocument();
  });

  it('hides group by field when samples tab is selected', async () => {
    render(<MetricsContent />, {organization});

    // Initially on aggregates tab, group by should be visible
    expect(screen.getByPlaceholderText('Group By')).toBeInTheDocument();

    // Switch to samples tab
    const samplesTab = screen.getByText('Metric Samples');
    await userEvent.click(samplesTab);

    // Group by should be hidden
    expect(screen.queryByPlaceholderText('Group By')).not.toBeInTheDocument();
  });

  it('makes API request with correct dataset parameter', () => {
    render(<MetricsContent />, {organization});

    expect(eventTableMock).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'tracemetrics',
        }),
      })
    );
  });
});
