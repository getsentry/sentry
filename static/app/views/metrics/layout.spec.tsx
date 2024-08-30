import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import * as metricsContext from 'sentry/views/metrics/context';
import {MetricsLayout} from 'sentry/views/metrics/layout';

const useMetricsContextReturnValueMock = {
  addWidget: () => {},
  duplicateWidget: () => {},
  focusArea: {},
  hasCustomMetrics: false,
  hasPerformanceMetrics: false,
  highlightedSampleId: undefined,
  isDefaultQuery: false,
  isMultiChartMode: false,
  isHasMetricsLoading: true,
  metricsSamples: [],
  removeWidget: () => {},
  selectedWidgetIndex: 0,
  setDefaultQuery: () => {},
  setHighlightedSampleId: () => {},
  setIsMultiChartMode: () => {},
  setMetricsSamples: () => {},
  setSelectedWidgetIndex: () => {},
  showQuerySymbols: false,
  updateWidget: () => {},
  widgets: [],
  toggleWidgetVisibility: () => {},
};

jest.mock('sentry/views/metrics/useCreateDashboard');
jest.mock('sentry/views/metrics/scratchpad');
jest.mock('sentry/views/metrics/queries');

describe('Metrics Layout', function () {
  const organization = OrganizationFixture({
    features: [
      'custom-metrics',
      'custom-metrics-extraction-rule',
      'custom-metrics-extraction-rule-ui',
    ],
  });

  it("already using performance and don't have old custom metrics", async function () {
    jest.spyOn(metricsContext, 'useMetricsContext').mockReturnValue({
      ...useMetricsContextReturnValueMock,
      hasCustomMetrics: false,
      hasPerformanceMetrics: true,
      isHasMetricsLoading: false,
    });

    render(<MetricsLayout />, {organization});

    // Button: Add Custom Metrics
    expect(
      await screen.findByRole('button', {name: 'Add Custom Metrics'})
    ).toBeInTheDocument();

    // Alert: No alert shall be rendered
    expect(
      screen.queryByText(/there are upcoming changes to the Metrics API/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Metrics using with the old API will stop being ingested/i)
    ).not.toBeInTheDocument();

    // Main View: Does not display the empty state.
    expect(screen.queryByText(/track and solve what matters/i)).not.toBeInTheDocument();
  });

  it("not using performance and don't have old custom metrics", async function () {
    jest.spyOn(metricsContext, 'useMetricsContext').mockReturnValue({
      ...useMetricsContextReturnValueMock,
      hasCustomMetrics: false,
      hasPerformanceMetrics: false,
      isHasMetricsLoading: false,
    });

    render(<MetricsLayout />, {organization});

    // Main View: Empty State
    expect(await screen.findByText(/track and solve what matters/i)).toBeInTheDocument();

    // Button: Set Up Tracing
    expect(screen.getByRole('button', {name: 'Set Up Tracing'})).toBeInTheDocument();

    // Not in the page: Add Custom Metrics
    expect(
      screen.queryByRole('button', {name: 'Add Custom Metrics'})
    ).not.toBeInTheDocument();
  });

  it('not using performance and have old custom metrics', async function () {
    jest.spyOn(metricsContext, 'useMetricsContext').mockReturnValue({
      ...useMetricsContextReturnValueMock,
      hasCustomMetrics: true,
      hasPerformanceMetrics: false,
      isHasMetricsLoading: false,
    });

    render(<MetricsLayout />, {organization});

    // Alert: Old API metrics ingestion ending soon.
    expect(
      await screen.findByText(/Metrics using with the old API will stop being ingested/i)
    ).toBeInTheDocument();

    // Button: Add Custom Metrics
    expect(screen.getByRole('button', {name: 'Add Custom Metrics'})).toBeInTheDocument();

    // Main View: Does not display the empty state.
    expect(screen.queryByText(/track and solve what matters/i)).not.toBeInTheDocument();
  });
});
