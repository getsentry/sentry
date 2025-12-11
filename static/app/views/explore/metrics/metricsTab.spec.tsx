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
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTab';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {TraceItemDataset} from 'sentry/views/explore/types';

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
      title: 'Test Title',
    },
  });

  function ProviderWrapper({children}: {children: React.ReactNode}) {
    return (
      <MultiMetricsQueryParamsProvider>
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.TRACEMETRICS} enabled>
          {children}
        </TraceItemAttributeProvider>
      </MultiMetricsQueryParamsProvider>
    );
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
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'POST',
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
      expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
        1,
        'metrics.explorer.metadata',
        expect.objectContaining({
          organization,
          metric_queries_count: 1,
          metric_panels_with_filters_count: 0,
          metric_panels_with_group_bys_count: 0,
          datetime_selection: '--14d',
          environment_count: 0,
          has_exceeded_performance_usage_limit: false,
          interval: '1h',
          project_count: 1,
          title: 'Test Title',
        })
      );
    });

    await waitFor(() => {
      expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
        2,
        'metrics.explorer.panel.metadata',
        expect.objectContaining({
          panel_index: 0,
          query_status: 'success',
          sample_counts: [0],
          table_result_length: 6,
          table_result_mode: 'aggregates',
          table_result_sort: ['-timestamp'],
          user_queries: '',
          user_queries_count: 0,
          aggregate_function: 'per_second',
          confidences: ['null'],
          dataScanned: 'full',
          dataset: 'metrics',
          empty_buckets_percentage: [],
          group_bys: [],
          interval: '1h',
          metric_name: 'bar',
          metric_type: 'distribution',
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
        panel_index: 1,
        query_status: 'success',
        sample_counts: [0],
        table_result_length: 6,
        table_result_mode: 'aggregates',
        table_result_sort: ['-timestamp'],
        user_queries: '',
        user_queries_count: 0,
        aggregate_function: 'per_second',
        confidences: ['null'],
        dataScanned: 'full',
        dataset: 'metrics',
        empty_buckets_percentage: [],
        group_bys: [],
        interval: '1h',
        metric_name: 'bar',
        metric_type: 'distribution',
      })
    );

    expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
      2,
      'metrics.explorer.metadata',
      expect.objectContaining({
        metric_queries_count: 2,
        metric_panels_with_filters_count: 0,
        metric_panels_with_group_bys_count: 0,
        project_count: 1,
        environment_count: 0,
        has_exceeded_performance_usage_limit: false,
        interval: '1h',
        title: 'Test Title',
      })
    );

    expect(trackAnalyticsMock).toHaveBeenCalledTimes(2);
    trackAnalyticsMock.mockClear();
    await userEvent.click(within(toolbars[0]!).getByRole('button', {name: 'bar'}));
    await userEvent.click(within(toolbars[0]!).getByRole('option', {name: 'foo'}));
    expect(within(toolbars[0]!).getByRole('button', {name: 'foo'})).toBeInTheDocument();

    await waitFor(() => {
      expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
        1,
        'metrics.explorer.panel.metadata',
        expect.objectContaining({
          panel_index: 0,
          aggregate_function: 'per_second',
          group_bys: [],
          metric_name: 'foo',
          metric_type: 'distribution',
        })
      );
    });

    expect(trackAnalyticsMock).toHaveBeenCalledTimes(1);
  });

  it('should fire analytics when group by is changed', async () => {
    const metricQueryWithGroupBy = JSON.stringify({
      metric: {name: 'bar', type: 'distribution'},
      query: '',
      aggregateFields: [
        {groupBy: 'environment'},
        {yAxes: ['per_second(bar)'], displayType: 'line'},
      ],
      aggregateSortBys: [],
      mode: 'aggregate',
    });

    const initialRouterConfigWithGroupBy = {
      location: {
        pathname: '/organizations/:orgId/explore/metrics/',
        query: {
          start: '2025-04-10T14%3A37%3A55',
          end: '2025-04-10T20%3A04%3A51',
          metric: [metricQueryWithGroupBy],
          title: 'Test Title',
        },
      },
      route: '/organizations/:orgId/explore/metrics/',
    };

    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        initialRouterConfig: initialRouterConfigWithGroupBy,
        organization,
      }
    );

    const toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(1);

    await waitFor(() => {
      expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
        1,
        'metrics.explorer.panel.metadata',
        expect.objectContaining({
          panel_index: 0,
          aggregate_function: 'per_second',
          group_bys: ['environment'],
          metric_name: 'bar',
          metric_type: 'distribution',
        })
      );
    });

    expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
      2,
      'metrics.explorer.metadata',
      expect.objectContaining({
        metric_panels_with_filters_count: 0,
        metric_panels_with_group_bys_count: 1,
        metric_queries_count: 1,
      })
    );

    expect(trackAnalyticsMock).toHaveBeenCalledTimes(2);
  });

  it('should fire analytics when filter is changed', async () => {
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
      expect(within(toolbars[0]!).getByRole('button', {name: 'bar'})).toBeInTheDocument();
    });

    trackAnalyticsMock.mockClear();

    const searchInput = within(toolbars[0]!).getByRole('combobox');
    await userEvent.click(searchInput);
    await userEvent.type(searchInput, 'has:environment{enter}');

    await waitFor(() => {
      expect(trackAnalyticsMock).toHaveBeenCalledWith(
        'metrics.explorer.panel.metadata',
        expect.objectContaining({
          panel_index: 0,
          user_queries: 'has:environment',
          user_queries_count: 1,
        })
      );
    });

    await waitFor(() => {
      expect(trackAnalyticsMock).toHaveBeenCalledWith(
        'metrics.explorer.metadata',
        expect.objectContaining({
          metric_panels_with_filters_count: 1,
          metric_panels_with_group_bys_count: 0,
          metric_queries_count: 1,
        })
      );
    });
  });

  it('should fire analytics with no metrics available', async () => {
    MockApiClient.clearMockResponses();
    setupPageFilters();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
      match: [
        MockApiClient.matchQuery({
          dataset: 'tracemetrics',
          referrer: 'api.explore.metric-options',
        }),
      ],
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
      expect(
        within(toolbars[0]!).getByRole('button', {name: 'None'})
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId('metric-panel')).toBeInTheDocument();

    // Only the explorer metadata event should be fired, not the panel event
    await waitFor(() => {
      expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
        1,
        'metrics.explorer.metadata',
        expect.objectContaining({
          organization,
          metric_queries_count: 0,
          metric_panels_with_filters_count: 0,
          metric_panels_with_group_bys_count: 0,
          datetime_selection: '--14d',
          environment_count: 0,
          has_exceeded_performance_usage_limit: false,
          interval: '1h',
          project_count: 1,
          title: 'Test Title',
        })
      );
    });

    expect(trackAnalyticsMock).toHaveBeenCalledTimes(1);
  });
});
