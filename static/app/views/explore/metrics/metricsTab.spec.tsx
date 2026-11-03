import {OrganizationFixture} from 'sentry-fixture/organization';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {
  createTraceMetricFixtures,
  initializeTraceMetricsTest,
} from 'sentry-fixture/tracemetrics';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {trackAnalytics} from 'sentry/utils/analytics';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {decodeList} from 'sentry/utils/queryString';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  defaultMetricQuery,
  encodeMetricQueryParams,
} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsTabContent} from 'sentry/views/explore/metrics/metricsTab';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

jest.mock('sentry/utils/analytics');
const trackAnalyticsMock = jest.mocked(trackAnalytics);

jest.mock('sentry/views/explore/metrics/multiMetricsQueryParams', () => ({
  ...jest.requireActual('sentry/views/explore/metrics/multiMetricsQueryParams'),
  MAX_METRICS_ALLOWED: 3,
}));

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

const validationBody: EventValidationData = {
  dataset: [],
  environment: [],
  field: [],
  orderby: [],
  projects: [],
  query: {error: null, fields: [], valid: true},
  valid: true,
};

const encodedBarMetric = encodeMetricQueryParams({
  ...defaultMetricQuery(),
  metric: {name: 'bar', type: 'distribution'},
});

const encodedP50BarMetric = JSON.stringify({
  metric: {name: 'bar', type: 'distribution'},
  query: '',
  aggregateFields: [
    new VisualizeFunction('p50(value,bar,distribution,none)').serialize(),
  ],
  aggregateSortBys: [],
  mode: 'samples',
});

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
      metric: [encodedBarMetric],
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

  const scrollIntoView = jest.fn();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    trackAnalyticsMock.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
    resetMockDate();
    setupPageFilters();

    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    setupTraceItemsMock(metricFixtures.detailedFixtures);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: [], meta: {fields: {}, units: {}, dataScanned: 'full'}},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/validate/`,
      method: 'GET',
      body: validationBody,
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
      url: `/organizations/${organization.slug}/stats_v2/`,
      method: 'GET',
      body: {},
    });
  });

  it('edits panel transformations in the URL without changing other metrics', async () => {
    const firstMetric = JSON.stringify({
      metric: {name: 'bar', type: 'distribution'},
      query: '',
      aggregateFields: [
        {yAxes: ['p50(value,bar,distribution,none)'], transformations: ['fill(locf)']},
        {yAxes: ['p90(value,bar,distribution,none)'], transformations: ['fill(linear)']},
        {groupBy: 'project'},
      ],
      aggregateSortBys: [],
      mode: 'samples',
    });
    const otherMetric = JSON.stringify({
      metric: {name: 'foo', type: 'counter'},
      query: '',
      aggregateFields: [
        {yAxes: ['sum(value,foo,counter,none)'], transformations: ['smooth(asap)']},
      ],
      aggregateSortBys: [{field: 'sum(value,foo,counter,none)', kind: 'desc'}],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      mode: 'samples',
    });
    const {router} = render(
      <MetricsTabContent datePageFilterProps={datePageFilterProps} />,
      {
        additionalWrapper: ProviderWrapper,
        organization: {
          ...organization,
          features: [...organization.features, 'explore-interpolation-and-smoothing'],
        },
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialLocation,
            query: {...initialLocation.query, metric: [firstMetric, otherMetric]},
          },
        },
      }
    );

    const firstPanel = screen.getAllByTestId('metric-panel')[0]!;
    await userEvent.click(
      within(firstPanel).getByRole('button', {name: 'Add Transformation'})
    );
    await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));
    await userEvent.click(within(firstPanel).getByRole('button', {name: 'Window Size'}));
    await userEvent.click(screen.getByRole('option', {name: '4'}));

    await waitFor(() => {
      const encodedMetrics = decodeList(router.location.query.metric);
      expect(JSON.parse(encodedMetrics[0]!)).toMatchObject({
        aggregateFields: [
          {
            yAxes: ['p50(value,bar,distribution,none)'],
            transformations: ['fill(locf)', 'smooth(sma,4)'],
          },
          {
            yAxes: ['p90(value,bar,distribution,none)'],
            transformations: ['fill(locf)', 'smooth(sma,4)'],
          },
          {groupBy: 'project'},
        ],
      });
      expect(encodedMetrics[1]).toBe(otherMetric);
    });

    await userEvent.click(
      within(firstPanel).getAllByRole('button', {name: 'Remove transformation'})[1]!
    );
    await userEvent.click(
      within(firstPanel).getByRole('button', {name: 'Remove transformation'})
    );
    await waitFor(() => {
      const encodedMetrics = decodeList(router.location.query.metric);
      expect(JSON.parse(encodedMetrics[0]!)).toMatchObject({
        aggregateFields: [
          {yAxes: ['p50(value,bar,distribution,none)']},
          {yAxes: ['p90(value,bar,distribution,none)']},
          {groupBy: 'project'},
        ],
      });
      expect(encodedMetrics[0]).not.toContain('transformations');
      expect(encodedMetrics[1]).toBe(otherMetric);
    });
  });

  it('allows query saves when a later metric row has transformations', async () => {
    renderGlobalModal({organization, additionalWrapper: ProviderWrapper});
    render(<MetricsTabContent datePageFilterProps={datePageFilterProps} />, {
      additionalWrapper: ProviderWrapper,
      organization,
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialLocation,
          query: {
            ...initialLocation.query,
            metric: [
              encodedBarMetric,
              JSON.stringify({
                metric: {name: 'bar', type: 'distribution'},
                aggregateFields: [
                  {
                    yAxes: ['p50(value,bar,distribution,none)'],
                    transformations: ['fill(locf)', 'smooth(sma,5)'],
                  },
                ],
              }),
            ],
          },
        },
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));
    expect(screen.getByRole('menuitemradio', {name: 'New Query'})).toBeEnabled();
    expect(screen.getByRole('menuitemradio', {name: 'Dashboard widget'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByRole('menuitemradio', {name: 'Monitor for'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'New Query'}));
    expect(
      await screen.findByPlaceholderText('Enter a name for your new query')
    ).toBeVisible();
    expect(
      await within(screen.getAllByTestId('metric-toolbar')[1]!).findByRole('button', {
        name: 'bar',
      })
    ).toBeInTheDocument();
  });

  it.each(['Add Metric', 'Add Equation'])(
    'scrolls the new panel into view when %s is clicked',
    async buttonName => {
      render(
        <ProviderWrapper>
          <MetricsTabContent datePageFilterProps={datePageFilterProps} />
        </ProviderWrapper>,
        {
          initialRouterConfig,
          organization,
        }
      );

      expect(await screen.findAllByTestId('metric-panel')).toHaveLength(1);

      await userEvent.click(screen.getAllByRole('button', {name: buttonName})[0]!);

      await waitFor(() => {
        expect(screen.getAllByTestId('metric-panel')).toHaveLength(2);
      });
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(
        screen.getAllByTestId('metric-panel')[1]
      );
    }
  );

  describe('when another chart fetches new data', () => {
    function renderWithTwoPanels() {
      render(
        <ProviderWrapper>
          <MetricsTabContent datePageFilterProps={datePageFilterProps} />
        </ProviderWrapper>,
        {
          initialRouterConfig: {
            ...initialRouterConfig,
            location: {
              ...initialLocation,
              query: {
                ...initialLocation.query,
                metric: [encodedBarMetric, encodedP50BarMetric, encodedBarMetric],
              },
            },
          },
          organization,
        }
      );
    }

    async function changeLastPanelAggregate() {
      await userEvent.click(screen.getAllByRole('button', {name: /Agg/})[2]!);
      await userEvent.click(await screen.findByRole('option', {name: 'p75'}));
    }

    function getYAxesAfter(mock: jest.Mock, callCount: number) {
      return mock.mock.calls
        .slice(callCount)
        .map(([, options]) => options.query.yAxis[0])
        .sort();
    }

    it('refetches charts fetched in an earlier interval', async () => {
      const timeseriesMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        method: 'GET',
        body: {timeSeries: [TimeSeriesFixture()]},
      });
      renderWithTwoPanels();
      expect(await screen.findAllByText(/data points/)).toHaveLength(3);
      const initialCallCount = timeseriesMock.mock.calls.length;
      setMockDate(Date.now() + 24 * 60 * 60 * 1000);

      await changeLastPanelAggregate();

      await waitFor(() =>
        expect(getYAxesAfter(timeseriesMock, initialCallCount)).toEqual([
          'p50(value,bar,distribution,none)',
          'p75(value,bar,distribution,none)',
          'sum(value)',
        ])
      );
    });

    it('refetches charts requested in an earlier interval when their responses arrived later', async () => {
      const {promise: responsesReleased, resolve: releaseResponses} =
        Promise.withResolvers<void>();
      const timeseriesMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        method: 'GET',
        asyncDelay: responsesReleased,
        body: {timeSeries: [TimeSeriesFixture()]},
      });
      renderWithTwoPanels();
      await waitFor(() => expect(timeseriesMock).toHaveBeenCalledTimes(2));
      setMockDate(Date.now() + 24 * 60 * 60 * 1000);
      releaseResponses();
      expect(await screen.findAllByText(/data points/)).toHaveLength(3);

      await changeLastPanelAggregate();

      await waitFor(() =>
        expect(getYAxesAfter(timeseriesMock, 2)).toEqual([
          'p50(value,bar,distribution,none)',
          'p75(value,bar,distribution,none)',
          'sum(value)',
        ])
      );
    });

    it('refetches charts whose earlier requests were in flight when another chart fetched', async () => {
      const {promise: responsesReleased, resolve: releaseResponses} =
        Promise.withResolvers<void>();
      const timeseriesMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        method: 'GET',
        asyncDelay: responsesReleased,
        body: {timeSeries: [TimeSeriesFixture()]},
      });
      renderWithTwoPanels();
      await waitFor(() => expect(timeseriesMock).toHaveBeenCalledTimes(2));
      setMockDate(Date.now() + 24 * 60 * 60 * 1000);

      await changeLastPanelAggregate();
      await waitFor(() => expect(timeseriesMock).toHaveBeenCalledTimes(3));
      releaseResponses();

      await waitFor(() =>
        expect(getYAxesAfter(timeseriesMock, 2)).toEqual([
          'p50(value,bar,distribution,none)',
          'p75(value,bar,distribution,none)',
          'sum(value)',
        ])
      );
    });

    it('refetches high accuracy charts fetched in an earlier interval', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        method: 'GET',
        match: [MockApiClient.matchQuery({sampling: SAMPLING_MODE.NORMAL})],
        body: (_url: string, options: {query: {yAxis: string[]}}) => {
          const timeSeries = TimeSeriesFixture({yAxis: options.query.yAxis[0]});
          return {
            timeSeries: [
              {...timeSeries, meta: {...timeSeries.meta, dataScanned: 'partial'}},
            ],
          };
        },
      });
      const highAccuracyMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        method: 'GET',
        match: [MockApiClient.matchQuery({sampling: SAMPLING_MODE.HIGH_ACCURACY})],
        body: (_url: string, options: {query: {yAxis: string[]}}) => ({
          timeSeries: [TimeSeriesFixture({yAxis: options.query.yAxis[0]})],
        }),
      });
      renderWithTwoPanels();
      await waitFor(() => expect(highAccuracyMock).toHaveBeenCalledTimes(2));
      setMockDate(Date.now() + 24 * 60 * 60 * 1000);

      await changeLastPanelAggregate();

      await waitFor(() =>
        expect(getYAxesAfter(highAccuracyMock, 2)).toEqual([
          'p50(value,bar,distribution,none)',
          'p75(value,bar,distribution,none)',
          'sum(value)',
        ])
      );
    });

    it('does not refetch charts fetched in the current interval', async () => {
      const timeseriesMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-timeseries/`,
        method: 'GET',
        body: {timeSeries: [TimeSeriesFixture()]},
      });
      renderWithTwoPanels();
      expect(await screen.findAllByText(/data points/)).toHaveLength(3);
      const initialCallCount = timeseriesMock.mock.calls.length;

      await changeLastPanelAggregate();

      await waitFor(() =>
        expect(getYAxesAfter(timeseriesMock, initialCallCount)).toEqual([
          'p75(value,bar,distribution,none)',
        ])
      );
    });
  });

  it('prompts for an equation instead of loading when an added equation is empty', async () => {
    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        initialRouterConfig,
        organization,
      }
    );
    expect(await screen.findAllByTestId('metric-panel')).toHaveLength(1);

    await userEvent.click(screen.getAllByRole('button', {name: 'Add Equation'})[0]!);

    const equationPanel = within(await screen.findByTestId('equation-metric-panels'));
    expect(
      equationPanel.getByText('Enter an equation to see results')
    ).toBeInTheDocument();
    expect(
      equationPanel.getByText('Enter an equation to see aggregates')
    ).toBeInTheDocument();
    expect(equationPanel.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('copies the last edited metric when adding another metric', async () => {
    render(
      <ProviderWrapper>
        <MetricsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {
              ...initialRouterConfig.location.query,
              metric: [encodedBarMetric, encodedBarMetric],
            },
          },
        },
        organization,
      }
    );

    expect(screen.getAllByTestId('metric-toolbar')).toHaveLength(2);
    await waitFor(() => {
      expect(
        within(screen.getAllByTestId('metric-toolbar')[1]!).getByRole('button', {
          name: 'bar',
        })
      ).toBeInTheDocument();
    });

    await userEvent.click(
      within(screen.getAllByTestId('metric-toolbar')[1]!).getByRole('button', {
        name: 'bar',
      })
    );
    await userEvent.click(
      within(screen.getAllByTestId('metric-toolbar')[1]!).getByRole('option', {
        name: 'foo',
      })
    );
    expect(
      await within(screen.getAllByTestId('metric-toolbar')[1]!).findByRole('button', {
        name: 'foo',
      })
    ).toBeInTheDocument();

    const addButton = screen.getAllByRole('button', {name: 'Add Metric'})[0]!;
    expect(addButton).toBeEnabled();
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getAllByTestId('metric-toolbar')).toHaveLength(3);
    });
    expect(
      within(screen.getAllByTestId('metric-toolbar')[2]!).getByRole('button', {
        name: 'foo',
      })
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('metric-panel')).toHaveLength(3);
  });

  it.isKnownFlake('should fire analytics for metadata', async () => {
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

    await waitFor(() => {
      expect(trackAnalyticsMock).toHaveBeenNthCalledWith(
        2,
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

    expect(trackAnalyticsMock).toHaveBeenCalledTimes(2);
    trackAnalyticsMock.mockClear();

    const addButtons = screen.getAllByRole('button', {name: 'Add Metric'});
    await userEvent.click(addButtons[0]!);

    await waitFor(() => {
      expect(screen.getAllByTestId('metric-panel')).toHaveLength(2);
    });

    await waitFor(() => {
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
    });

    await waitFor(() => {
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
    });

    expect(trackAnalyticsMock).toHaveBeenCalledTimes(2);
    trackAnalyticsMock.mockClear();
    await userEvent.click(within(toolbars[0]!).getByRole('button', {name: 'bar'}));
    await userEvent.click(within(toolbars[0]!).getByRole('option', {name: 'foo'}));
    expect(
      await within(toolbars[0]!).findByRole('button', {name: 'foo'})
    ).toBeInTheDocument();

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
    // Use a router config with no pre-selected metric so the component starts with an empty selection.
    const {metric: _metric, ...queryWithoutMetric} = initialLocation.query ?? {};
    const noMetricRouterConfig = {
      location: {...initialLocation, query: queryWithoutMetric},
      route: '/organizations/:orgId/explore/metrics/',
    };

    MockApiClient.clearMockResponses();
    setupPageFilters();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/validate/`,
      method: 'GET',
      body: validationBody,
    });

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
        initialRouterConfig: noMetricRouterConfig,
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

  it('renders aggregate and equation panels in separate sections', async () => {
    const orgWithFeatures = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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
                    new VisualizeFunction('p50(value,bar,distribution,none)').serialize(),
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
      features: ['tracemetrics-enabled'],
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
              metric: [metricQueryWithGroupBy, metricQueryWithGroupBy],
              title: 'Test Title',
            },
          },
          route: '/organizations/:orgId/explore/metrics/',
        },
      }
    );
    expect(await screen.findAllByText('Add Metric')).not.toHaveLength(0);
    expect(screen.getAllByText('Add Equation').length).toBeGreaterThan(0);

    // Only 2 entries (cap is 3) -> both buttons are enabled
    for (const button of screen.getAllByRole('button', {
      name: 'Add Metric',
    })) {
      expect(button).toBeEnabled();
    }
    for (const button of screen.getAllByRole('button', {name: 'Add Equation'})) {
      expect(button).toBeEnabled();
    }

    // Add an entry, 3 entries (at cap) -> both buttons are disabled
    await userEvent.click(screen.getAllByRole('button', {name: 'Add Metric'})[0]!);
    for (const button of screen.getAllByRole('button', {
      name: 'Add Metric',
    })) {
      expect(button).toBeDisabled();
    }
    for (const button of screen.getAllByRole('button', {name: 'Add Equation'})) {
      expect(button).toBeDisabled();
    }
  });

  it('disables delete button for metrics referenced by an equation', async () => {
    const orgWithEquations = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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
    ).toHaveAttribute('aria-disabled', 'true');

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
