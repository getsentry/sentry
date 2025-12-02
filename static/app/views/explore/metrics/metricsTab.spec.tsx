import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {
  createTraceMetricFixtures,
  initializeTraceMetricsTest,
} from 'sentry-fixture/tracemetrics';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTab';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';

jest.mock('sentry/utils/analytics');
const trackAnalyticsMock = jest.mocked(trackAnalytics);

const datePageFilterProps: DatePageFilterProps = {
  defaultPeriod: '7d' as const,
  maxPickableDays: 7,
  relativeOptions: ({arbitraryOptions}) => ({
    ...arbitraryOptions,
    '1h': 'Last hour',
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
  }),
};

describe('MetricsTabContent', () => {
  const {
    organization,
    project,
    initialLocation,
    setupPageFilters,
    setupTraceItemsMock,
    setupEventsMock,
  } = initializeTraceMetricsTest({
    orgFeatures: ['tracemetrics-enabled'],
    routerQuery: {
      start: '2025-04-10T14%3A37%3A55',
      end: '2025-04-10T20%3A04%3A51',
      metric: ['bar||distribution'],
    },
  });

  function ProviderWrapper({children}: {children: React.ReactNode}) {
    return <MultiMetricsQueryParamsProvider>{children}</MultiMetricsQueryParamsProvider>;
  }

  const initialRouterConfig = {
    location: initialLocation,
    route: '/organizations/:orgId/explore/metrics/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    trackAnalyticsMock.mockClear();
    setupPageFilters();

    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    setupTraceItemsMock(metricFixtures.detailedFixtures);
    setupEventsMock(metricFixtures.detailedFixtures, [
      MockApiClient.matchQuery({
        dataset: 'tracemetrics',
        referrer: 'api.explore.metric-options',
      }),
    ]);

    setupEventsMock(metricFixtures.detailedFixtures, [
      MockApiClient.matchQuery({
        dataset: 'tracemetrics',
        referrer: 'api.explore.metric-aggregates-table',
      }),
    ]);

    setupEventsMock(metricFixtures.detailedFixtures, [
      MockApiClient.matchQuery({
        dataset: 'tracemetrics',
        referrer: 'api.explore.metric-samples-table',
      }),
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [TimeSeriesFixture()],
      },
      match: [
        MockApiClient.matchQuery({
          referrer: 'api.explore.metric-timeseries',
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [TimeSeriesFixture()],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      method: 'GET',
      body: {},
    });
  });

  it('should add a metric when Add Metric button is clicked', async () => {
    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        initialRouterConfig,
        organization,
      }
    );

    let toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(1);
    // have to wait for the response to load
    await waitFor(() => {
      // selects the first metric available - sorted alphanumerically
      expect(within(toolbars[0]!).getByRole('button', {name: 'bar'})).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(1);

    let addButton = screen.getByRole('button', {name: 'Add Metric'});
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();

    await userEvent.click(addButton);

    toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(2);
    // copies the last metric as a starting point
    expect(within(toolbars[1]!).getByRole('button', {name: 'bar'})).toBeInTheDocument();
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(2);

    // change the second metric from bar to foo
    await userEvent.click(within(toolbars[1]!).getByRole('button', {name: 'bar'}));
    await userEvent.click(within(toolbars[1]!).getByRole('option', {name: 'foo'}));
    expect(within(toolbars[1]!).getByRole('button', {name: 'foo'})).toBeInTheDocument();

    addButton = screen.getByRole('button', {name: 'Add Metric'});
    expect(addButton).toBeInTheDocument();
    expect(addButton).toBeEnabled();

    await userEvent.click(addButton);

    toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(3);
    // copies the last metric as a starting point
    expect(within(toolbars[2]!).getByRole('button', {name: 'foo'})).toBeInTheDocument();
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(3);
  });

  it('should fire analytics for metadata', async () => {
    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        initialRouterConfig,
        organization,
      }
    );

    const toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(1);

    await waitFor(() => {
      expect(trackAnalyticsMock).toHaveBeenCalledWith(
        'metrics.explorer.metadata',
        expect.objectContaining({
          organization,
          metric_queries_count: 1,
        })
      );
    });

    await waitFor(() => {
      expect(trackAnalyticsMock).toHaveBeenCalledWith(
        'metrics.explorer.panel.metadata',
        expect.objectContaining({
          organization,
          panel_index: 0, // First panel should have index 0
        })
      );
    });
    expect(trackAnalyticsMock).toHaveBeenCalledTimes(2);
    trackAnalyticsMock.mockClear();

    const addButton = screen.getByRole('button', {name: 'Add Metric'});
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getAllByTestId('metric-panel')).toHaveLength(2);
    });

    expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
      1,
      'metrics.explorer.panel.metadata',
      expect.objectContaining({
        organization,
        panel_index: 1, // Only the new panel should fire
      })
    );

    expect(trackAnalyticsMock).toHaveBeenCalledTimes(1);

    trackAnalyticsMock.mockClear();
    // Picking a new metric on the first panel should only fire one event for the panel update
    await userEvent.click(within(toolbars[0]!).getByRole('button', {name: 'bar'}));
    await userEvent.click(within(toolbars[0]!).getByRole('option', {name: 'foo'}));
    expect(within(toolbars[0]!).getByRole('button', {name: 'foo'})).toBeInTheDocument();

    expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
      1,
      'metrics.explorer.panel.metadata',
      expect.objectContaining({panel_index: 0})
    );
  });
});
