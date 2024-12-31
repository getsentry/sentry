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
    features: ['custom-metrics'],
  });

  it("already using performance and don't have old custom metrics", async function () {
    jest.spyOn(metricsContext, 'useMetricsContext').mockReturnValue({
      ...useMetricsContextReturnValueMock,
      hasCustomMetrics: false,
      hasPerformanceMetrics: true,
      isHasMetricsLoading: false,
    });

    render(<MetricsLayout />, {organization});

    // Button: Set Up Custom Metric
    expect(
      await screen.findByRole('button', {name: 'Set Up Custom Metric'})
    ).toBeInTheDocument();

    // Alert: Metrics beta experience ending soon.
    expect(screen.getByText(/we are ending the beta/i)).toBeInTheDocument();

    // Main View: Displays the empty state.
    expect(screen.getByText(/track and solve what matters/i)).toBeInTheDocument();

    expect(
      screen.getByRole('button', {name: 'View Performance Metrics'})
    ).toBeInTheDocument();
  });

  it("not using performance and doesn't have custom metrics", async function () {
    jest.spyOn(metricsContext, 'useMetricsContext').mockReturnValue({
      ...useMetricsContextReturnValueMock,
      hasCustomMetrics: false,
      hasPerformanceMetrics: false,
      isHasMetricsLoading: false,
    });

    render(<MetricsLayout />, {organization});

    // Main View: Empty State
    expect(await screen.findByText(/track and solve what matters/i)).toBeInTheDocument();

    // Button: Read Docs
    expect(screen.getByRole('button', {name: 'Read Docs'})).toBeInTheDocument();

    expect(
      screen.getByRole('button', {name: 'Set Up Custom Metric'})
    ).toBeInTheDocument();
  });

  it('not using performance and has custom metrics', async function () {
    jest.spyOn(metricsContext, 'useMetricsContext').mockReturnValue({
      ...useMetricsContextReturnValueMock,
      hasCustomMetrics: true,
      hasPerformanceMetrics: false,
      isHasMetricsLoading: false,
    });

    render(<MetricsLayout />, {organization});

    // Alert: Metrics beta experience ending soon.
    expect(await screen.findByText(/we are ending the beta/i)).toBeInTheDocument();

    // Button: Add Custom Metrics
    expect(screen.getByRole('button', {name: 'Add Custom Metrics'})).toBeInTheDocument();

    // Main View: Does not display the empty state.
    expect(screen.queryByText(/track and solve what matters/i)).not.toBeInTheDocument();
  });
});
