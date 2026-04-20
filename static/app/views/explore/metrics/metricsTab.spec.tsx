import {OrganizationFixture} from 'sentry-fixture/organization';
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

import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {trackAnalytics} from 'sentry/utils/analytics';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTab';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

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

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {}, units: {}, dataScanned: 'full'}},
    });

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
      url: `/customers/${organization.slug}/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {attributes: {}},
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

    let addButtons = screen.getAllByRole('button', {name: 'Add Metric'});
    expect(addButtons[0]).toBeEnabled();

    await userEvent.click(addButtons[0]!);

    toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(2);
    // copies the last metric as a starting point
    expect(within(toolbars[1]!).getByRole('button', {name: 'bar'})).toBeInTheDocument();
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(2);

    // change the second metric from bar to foo
    await userEvent.click(within(toolbars[1]!).getByRole('button', {name: 'bar'}));
    await userEvent.click(within(toolbars[1]!).getByRole('option', {name: 'foo'}));
    expect(within(toolbars[1]!).getByRole('button', {name: 'foo'})).toBeInTheDocument();

    addButtons = screen.getAllByRole('button', {name: 'Add Metric'});
    expect(addButtons[0]).toBeEnabled();

    await userEvent.click(addButtons[0]!);

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
          table_result_mode: 'metric samples',
          table_result_sort: ['-timestamp'],
          user_queries: '',
          user_queries_count: 0,
          aggregate_function: 'sum',
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

    const addButtons = screen.getAllByRole('button', {name: 'Add Metric'});
    await userEvent.click(addButtons[0]!);

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
        table_result_mode: 'metric samples',
        table_result_sort: ['-timestamp'],
        user_queries: '',
        user_queries_count: 0,
        aggregate_function: 'sum',
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
          aggregate_function: 'sum',
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
      url: `/customers/${organization.slug}/`,
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

  it('should switch to aggregate mode when a group by is added', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [
        {
          attributeType: 'string',
          key: 'test.region',
          name: 'test.region',
        },
        {
          attributeType: 'string',
          key: 'test.service',
          name: 'test.service',
        },
      ],
      match: [MockApiClient.matchQuery({attributeType: ['string', 'number', 'boolean']})],
    });

    const {router} = render(
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

    // Wait for the toolbar to load
    await waitFor(() => {
      expect(within(toolbars[0]!).getByRole('button', {name: 'bar'})).toBeInTheDocument();
    });

    // Verify initial state is samples mode
    const initialMetricQuery = JSON.parse(router.location.query.metric as string);
    expect(initialMetricQuery.mode).toBe('samples');

    // Click on the Group by selector - use text content since prefix renders differently
    const groupByButton = within(toolbars[0]!).getByText('Group by');
    await userEvent.click(groupByButton);

    // Select a group by option (test.region)
    const regionOption = await screen.findByRole('option', {name: 'test.region'});
    await userEvent.click(regionOption);

    let metricQuery = router.location.query.metric;
    expect(metricQuery).toBeDefined();

    // Verify that the mode switched to aggregate in the URL
    let parsedQuery: ReturnType<typeof JSON.parse>;
    await waitFor(() => {
      metricQuery = router.location.query.metric;
      parsedQuery = JSON.parse(metricQuery as string);
      expect(parsedQuery.mode).toBe('aggregate');
    });
    expect(parsedQuery.aggregateFields).toContainEqual({groupBy: 'test.region'});
  });

  it('does not show the Add Equation button when the feature flag is disabled', async () => {
    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        organization,
      }
    );
    expect(await screen.findAllByText('Add Metric')).toHaveLength(2);
    expect(screen.queryByText('Add Equation')).not.toBeInTheDocument();
  });

  it('shows the Add Equation button when the feature flag is enabled', async () => {
    const orgWithFeature = OrganizationFixture({
      features: ['tracemetrics-enabled', 'tracemetrics-equations-in-explore'],
    });
    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        organization: orgWithFeature,
      }
    );
    expect(await screen.findAllByText('Add Metric')).toHaveLength(2);
    expect(screen.getAllByText('Add Equation').length).toBeGreaterThan(0);
  });

  it('renders aggregate and equation panels in separate sections', async () => {
    const orgWithFeatures = OrganizationFixture({
      features: ['tracemetrics-enabled', 'tracemetrics-equations-in-explore'],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${orgWithFeatures.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        organization: orgWithFeatures,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/:orgId/explore/metrics/',
            query: {
              start: '2025-04-10T14%3A37%3A55',
              end: '2025-04-10T20%3A04%3A51',
              metric: [
                JSON.stringify({
                  metric: {name: 'bar', type: 'distribution'},
                  query: '',
                  aggregateFields: [
                    new VisualizeFunction('p50(value,bar,distribution,-)').serialize(),
                  ],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
                JSON.stringify({
                  metric: {name: '', type: ''},
                  query: '',
                  aggregateFields: [new VisualizeEquation(EQUATION_PREFIX).serialize()],
                  aggregateSortBys: [],
                  mode: 'samples',
                }),
              ],
              title: 'Test Title',
            },
          },
          route: '/organizations/:orgId/explore/metrics/',
        },
      }
    );

    const aggregateSection = await screen.findByTestId('aggregate-metric-panels');
    const equationSection = screen.getByTestId('equation-metric-panels');

    expect(within(aggregateSection).getAllByTestId('metric-panel')).toHaveLength(1);
    expect(within(equationSection).getAllByTestId('metric-panel')).toHaveLength(1);
  });

  it('disables both Add Metric and Add Equation buttons when the maximum number of metric queries is reached', async () => {
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
    const orgWithFeature = OrganizationFixture({
      features: ['tracemetrics-enabled', 'tracemetrics-equations-in-explore'],
    });
    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        organization: orgWithFeature,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/:orgId/explore/metrics/',
            query: {
              start: '2025-04-10T14%3A37%3A55',
              end: '2025-04-10T20%3A04%3A51',
              metric: [
                metricQueryWithGroupBy,
                metricQueryWithGroupBy,
                metricQueryWithGroupBy,
                metricQueryWithGroupBy,
                metricQueryWithGroupBy,
                metricQueryWithGroupBy,
                metricQueryWithGroupBy,
              ],
              title: 'Test Title',
            },
          },
          route: '/organizations/:orgId/explore/metrics/',
        },
      }
    );
    expect(await screen.findAllByText('Add Metric')).not.toHaveLength(0);
    expect(screen.getAllByText('Add Equation').length).toBeGreaterThan(0);

    // Only 7 entries -> both buttons are enabled
    for (const button of screen.getAllByRole('button', {name: 'Add Metric'})) {
      expect(button).toBeEnabled();
    }
    for (const button of screen.getAllByRole('button', {name: 'Add Equation'})) {
      expect(button).toBeEnabled();
    }

    // Add an entry, 8 entries -> both buttons are disabled
    await userEvent.click(screen.getAllByRole('button', {name: 'Add Metric'})[0]!);
    for (const button of screen.getAllByRole('button', {name: 'Add Metric'})) {
      expect(button).toBeDisabled();
    }
    for (const button of screen.getAllByRole('button', {name: 'Add Equation'})) {
      expect(button).toBeDisabled();
    }
  });

  it('disables delete button for metrics referenced by an equation', async () => {
    const orgWithEquations = OrganizationFixture({
      features: ['tracemetrics-enabled', 'tracemetrics-equations-in-explore'],
    });

    const metricA = JSON.stringify({
      metric: {name: 'metricA', type: 'distribution', unit: 'none'},
      query: '',
      aggregateFields: [{yAxes: ['sum(value,metricA,distribution,none)']}],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const metricB = JSON.stringify({
      metric: {name: 'metricB', type: 'distribution', unit: 'none'},
      query: '',
      aggregateFields: [{yAxes: ['sum(value,metricB,distribution,none)']}],
      aggregateSortBys: [],
      mode: 'samples',
    });

    const equation = JSON.stringify({
      metric: {name: '', type: ''},
      query: '',
      aggregateFields: [{yAxes: ['equation|sum(value,metricA,distribution,none)']}],
      aggregateSortBys: [],
      mode: 'samples',
    });

    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        organization: orgWithEquations,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/:orgId/explore/metrics/',
            query: {
              start: '2025-04-10T14%3A37%3A55',
              end: '2025-04-10T20%3A04%3A51',
              metric: [metricA, metricB, equation],
              title: 'Test Title',
            },
          },
          route: '/organizations/:orgId/explore/metrics/',
        },
      }
    );

    const toolbars = screen.getAllByTestId('metric-toolbar');
    expect(toolbars).toHaveLength(3);

    await waitFor(() => {
      expect(
        within(toolbars[0]!).getByRole('button', {name: 'metricA'})
      ).toBeInTheDocument();
    });

    // Metric A should be disabled because it is referenced by the equation
    expect(
      within(toolbars[0]!).getByRole('button', {name: 'Delete Metric'})
    ).toBeDisabled();

    // Metric B should be enabled because it is not referenced by the equation
    expect(
      within(toolbars[1]!).getByRole('button', {name: 'Delete Metric'})
    ).toBeEnabled();

    // Equation deletion should always be enabled
    expect(
      within(toolbars[2]!).getByRole('button', {name: 'Delete Metric'})
    ).toBeEnabled();
  });
});
