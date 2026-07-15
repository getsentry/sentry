import type {ReactNode} from 'react';
import qs from 'query-string';
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

import * as useMetricTraceDetailModule from 'sentry/views/explore/metrics/hooks/useMetricTraceDetail';
import {MetricDetails} from 'sentry/views/explore/metrics/metricInfoTabs/metricDetails';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  TraceMetricKnownFieldKey,
  type TraceMetricEventsResponseItem,
} from 'sentry/views/explore/metrics/types';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const TRACE_METRIC_FIXTURE_DATE = new Date('2025-04-03T15:50:10.000Z');

function createWrapper({
  queryParams,
  traceMetric,
}: {
  queryParams: ReadableQueryParams;
  traceMetric: TraceMetric;
}) {
  return function Wrapper({children}: {children: ReactNode}) {
    return (
      <MultiMetricsQueryParamsProvider>
        <MetricsQueryParamsProvider
          traceMetric={traceMetric}
          queryParams={queryParams}
          setQueryParams={() => {}}
          setTraceMetric={() => {}}
          removeMetric={() => {}}
        >
          {children}
        </MetricsQueryParamsProvider>
      </MultiMetricsQueryParamsProvider>
    );
  };
}

function setupMocks(orgSlug: string) {
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/events-timeseries/`,
    method: 'GET',
    body: {timeSeries: [TimeSeriesFixture()]},
  });

  // Catch-all for /events/ requests not matched by specific referrer mocks
  // (e.g. useRawCounts referrers: api.explore.metrics.raw-count.normal/high-accuracy)
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/events/`,
    method: 'GET',
    body: {data: [], meta: {fields: {}, units: {}, dataScanned: 'full'}},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/recent-searches/`,
    method: 'GET',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/recent-searches/`,
    method: 'POST',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/customers/${orgSlug}/`,
    method: 'GET',
    body: {},
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/trace-items/attributes/`,
    method: 'GET',
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/stats_v2/`,
    method: 'GET',
    body: {},
  });
}

describe('MetricPanel', () => {
  const traceMetric: TraceMetric = {name: 'bar', type: 'distribution'};
  const queryParams = new ReadableQueryParams({
    extrapolate: true,
    mode: Mode.SAMPLES,
    query: '',
    cursor: '',
    fields: ['id', 'timestamp'],
    sortBys: [{field: 'timestamp', kind: 'desc'}],
    aggregateCursor: '',
    aggregateFields: [new VisualizeFunction('sum(value)')],
    aggregateSortBys: [{field: 'sum(value)', kind: 'desc'}],
  });

  const {organization, project, setupPageFilters, setupEventsMock, setupTraceItemsMock} =
    initializeTraceMetricsTest({
      orgFeatures: ['tracemetrics-enabled'],
    });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
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

    setupMocks(organization.slug);
  });

  it('renders the metric panel', async () => {
    render(<MetricPanel traceMetric={traceMetric} queryIndex={0} queryLabel="A" />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    expect(await screen.findByTestId('metric-panel')).toBeInTheDocument();
  });

  it('renders the visualize label badge', async () => {
    render(<MetricPanel traceMetric={traceMetric} queryIndex={0} queryLabel="A" />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    // The visualize label badge "A" should be present
    expect(await screen.findByText('A')).toBeInTheDocument();
  });

  it('does not render orientation controls', async () => {
    render(<MetricPanel traceMetric={traceMetric} queryIndex={0} queryLabel="A" />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    expect(await screen.findByTestId('metric-panel')).toBeInTheDocument();

    // Orientation controls should NOT be present in the refreshed UI
    expect(screen.queryByRole('button', {name: 'Table bottom'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Table right'})).not.toBeInTheDocument();
  });

  it('uses the internal expression as the chart title for equations', async () => {
    const equationQueryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [new VisualizeEquation('equation|sum(value) + avg(value)')],
      aggregateSortBys: [{field: 'equation|sum(value) + avg(value)', kind: 'desc'}],
    });

    const equationOrg = {
      ...organization,
      features: [...organization.features],
    };

    render(
      <MetricPanel
        traceMetric={traceMetric}
        queryIndex={0}
        queryLabel="ƒ1"
        referenceMap={{A: 'sum(value)', B: 'avg(value)'}}
      />,
      {
        organization: equationOrg,
        additionalWrapper: createWrapper({
          queryParams: equationQueryParams,
          traceMetric,
        }),
      }
    );

    // The chart title should display the unresolved/internal expression (A + B),
    // not the resolved form (sum(value) + avg(value))
    expect(await screen.findByText('A + B')).toBeInTheDocument();
    expect(screen.queryByText('sum(value) + avg(value)')).not.toBeInTheDocument();
  });

  it('disables heat map visualization for equations', async () => {
    const equationQueryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [
        new VisualizeEquation('equation|sum(value) + avg(value)', {
          chartType: ChartType.LINE,
        }),
      ],
      aggregateSortBys: [{field: 'equation|sum(value) + avg(value)', kind: 'desc'}],
    });

    const equationOrg = {
      ...organization,
      features: [...organization.features, 'data-browsing-heat-map-widget'],
    };

    render(
      <MetricPanel
        traceMetric={traceMetric}
        queryIndex={0}
        queryLabel="ƒ1"
        referenceMap={{A: 'sum(value)', B: 'avg(value)'}}
      />,
      {
        organization: equationOrg,
        additionalWrapper: createWrapper({
          queryParams: equationQueryParams,
          traceMetric,
        }),
      }
    );

    const chartTypeSelect = await screen.findByTestId('metric-panel-chart-type-select');
    expect(chartTypeSelect).toBeInTheDocument();
    await userEvent.click(chartTypeSelect);
    expect(await screen.findByText('Type')).toBeInTheDocument();
    const heatMapOption = await screen.findByRole('option', {name: 'Heatmap'});
    expect(heatMapOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('disables heat map visualization for non-distribution metrics', async () => {
    const counterTraceMetric: TraceMetric = {name: 'bar', type: 'counter'};
    const counterQueryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [new VisualizeFunction('sum(value)', {chartType: ChartType.LINE})],
      aggregateSortBys: [{field: 'sum(value)', kind: 'desc'}],
    });

    const heatMapOrg = {
      ...organization,
      features: [...organization.features, 'data-browsing-heat-map-widget'],
    };

    render(
      <MetricPanel traceMetric={counterTraceMetric} queryIndex={0} queryLabel="A" />,
      {
        organization: heatMapOrg,
        additionalWrapper: createWrapper({
          queryParams: counterQueryParams,
          traceMetric: counterTraceMetric,
        }),
      }
    );

    const chartTypeSelect = await screen.findByTestId('metric-panel-chart-type-select');
    await userEvent.click(chartTypeSelect);
    const heatMapOption = await screen.findByRole('option', {name: 'Heatmap'});
    expect(heatMapOption).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders the samples column order', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());

    render(
      <MetricsSamplesTable overrideTableData={[metricFixtures.detailedFixtures[0]!]} />,
      {organization, additionalWrapper: createWrapper({queryParams, traceMetric})}
    );

    const samplesTable = await screen.findByRole('table');
    const columnHeaders = await within(samplesTable).findAllByRole('columnheader');
    expect(columnHeaders.map(header => header.textContent?.trim() ?? '')).toEqual([
      '',
      'Trace ID',
      'Project',
      'Value',
      'Timestamp',
    ]);
  });

  it('renders project and relative timestamp cells', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());

    render(
      <MetricsSamplesTable overrideTableData={[metricFixtures.detailedFixtures[0]!]} />,
      {organization, additionalWrapper: createWrapper({queryParams, traceMetric})}
    );

    expect(await screen.findByText(project.slug)).toBeInTheDocument();
    expect(screen.getAllByText(/ago$/).length).toBeGreaterThan(0);
  });

  it('adds trace waterfall metric-name actions for connected traces and explore', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    const row = metricFixtures.detailedFixtures[0]!;

    render(<MetricsSamplesTable source="traceWaterfall" overrideTableData={[row]} />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    const samplesTable = await screen.findByRole('table');
    const metricNameCell = within(samplesTable)
      .getByText(row[TraceMetricKnownFieldKey.METRIC_NAME])
      .closest('[role="cell"]')!;
    await userEvent.click(
      within(metricNameCell as HTMLElement).getByRole('button', {name: 'Actions'})
    );

    const link = (await screen.findByText('View connected traces')).closest('a')!;
    for (const label of ['Copy to clipboard', 'Add to filter', 'Exclude from filter']) {
      const menuItem = await screen.findByText(label);
      expect(menuItem.compareDocumentPosition(link)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    }

    const href = link.getAttribute('href')!;
    expect(href.startsWith(`/organizations/${organization.slug}/explore/traces/?`)).toBe(
      true
    );

    const parsedQuery = qs.parse(href.split('?')[1]!);
    expect(parsedQuery).toEqual(
      expect.objectContaining({
        mode: 'samples',
        project: project.id,
        referrer: 'trace-metrics-samples-table-connected-traces',
        statsPeriod: '24h',
      })
    );
    expect(parsedQuery.table).toBeUndefined();
    expect(JSON.parse(parsedQuery.crossEvents as string)).toEqual([
      {
        type: 'metrics',
        query: '',
        metric: {
          name: row[TraceMetricKnownFieldKey.METRIC_NAME],
          type: row[TraceMetricKnownFieldKey.METRIC_TYPE],
          unit: row[TraceMetricKnownFieldKey.METRIC_UNIT],
        },
      },
    ]);

    const openInExploreLink = (await screen.findByText('Open in Explore')).closest('a')!;
    const openInExploreHref = openInExploreLink.getAttribute('href')!;
    expect(
      openInExploreHref.startsWith(
        `/organizations/${organization.slug}/explore/metrics/?`
      )
    ).toBe(true);

    const openInExploreQuery = qs.parse(openInExploreHref.split('?')[1]!);
    expect(openInExploreQuery).toEqual(
      expect.objectContaining({
        project: project.id,
        referrer: 'trace-metrics-samples-table-open-in-explore',
      })
    );
    const aggregate = `sum(value,${row[TraceMetricKnownFieldKey.METRIC_NAME]},${row[TraceMetricKnownFieldKey.METRIC_TYPE]},${row[TraceMetricKnownFieldKey.METRIC_UNIT]})`;
    expect(JSON.parse(openInExploreQuery.metric as string)).toEqual(
      expect.objectContaining({
        metric: {
          name: row[TraceMetricKnownFieldKey.METRIC_NAME],
          type: row[TraceMetricKnownFieldKey.METRIC_TYPE],
          unit: row[TraceMetricKnownFieldKey.METRIC_UNIT],
        },
        aggregateFields: [{yAxes: [aggregate]}],
        aggregateSortBys: [{field: aggregate, kind: 'desc'}],
      })
    );
  });

  it('does not add embedded metric-name actions to metrics page samples', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());

    render(
      <MetricsSamplesTable overrideTableData={[metricFixtures.detailedFixtures[0]!]} />,
      {organization, additionalWrapper: createWrapper({queryParams, traceMetric})}
    );

    const samplesTable = await screen.findByRole('table');
    await userEvent.click(within(samplesTable).getByRole('button', {name: 'Actions'}));

    expect(await screen.findByText('Copy to clipboard')).toBeInTheDocument();
    expect(screen.queryByText('View connected traces')).not.toBeInTheDocument();
    expect(screen.queryByText('Open in Explore')).not.toBeInTheDocument();
  });

  it('adds issue details metric-name actions without add filter', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    const row = metricFixtures.detailedFixtures[0]!;

    render(<MetricsSamplesTable source="issueDetails" overrideTableData={[row]} />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    const samplesTable = await screen.findByRole('table');
    const metricNameCell = within(samplesTable)
      .getByText(row[TraceMetricKnownFieldKey.METRIC_NAME])
      .closest('[role="cell"]')!;
    await userEvent.click(
      within(metricNameCell as HTMLElement).getByRole('button', {name: 'Actions'})
    );

    expect(await screen.findByText('Copy to clipboard')).toBeInTheDocument();
    expect(await screen.findByText('View connected traces')).toBeInTheDocument();
    expect(await screen.findByText('Open in Explore')).toBeInTheDocument();
    expect(screen.queryByText('Add to filter')).not.toBeInTheDocument();
    expect(screen.queryByText('Exclude from filter')).not.toBeInTheDocument();
  });

  it('does not add embedded metric-name actions without a complete metric identity', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    const row = {
      ...metricFixtures.detailedFixtures[0]!,
      [TraceMetricKnownFieldKey.METRIC_TYPE]: '',
    } as TraceMetricEventsResponseItem;

    render(<MetricsSamplesTable source="traceWaterfall" overrideTableData={[row]} />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    const samplesTable = await screen.findByRole('table');
    const metricNameCell = within(samplesTable)
      .getByText(row[TraceMetricKnownFieldKey.METRIC_NAME])
      .closest('[role="cell"]')!;
    await userEvent.click(
      within(metricNameCell as HTMLElement).getByRole('button', {name: 'Actions'})
    );

    expect(await screen.findByText('Copy to clipboard')).toBeInTheDocument();
    expect(screen.queryByText('View connected traces')).not.toBeInTheDocument();
    expect(screen.queryByText('Open in Explore')).not.toBeInTheDocument();
  });

  it('fetches expanded sample details with the row timestamp', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    const row = metricFixtures.detailedFixtures[0]!;
    const timestamp = new Date(row.timestamp).getTime() / 1000;
    const metricId = row[TraceMetricKnownFieldKey.ID];
    const traceDetailsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/projects/${organization.slug}/${project.slug}/trace-items/${metricId}/`,
      match: [MockApiClient.matchQuery({timestamp})],
      body: {
        itemId: metricId,
        links: null,
        meta: {},
        timestamp: row.timestamp,
        attributes: [],
      },
    });
    const traceMetaMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/events-trace-meta/${row.trace}/`,
      match: [MockApiClient.matchData({timestamp})],
      body: {
        errors: 1,
        performance_issues: 0,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: [],
        span_count: 2,
        span_count_map: {},
      },
    });

    render(
      <table>
        <tbody>
          <MetricDetails dataRow={row} ref={{current: null}} showTelemetry />
        </tbody>
      </table>,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      }
    );

    await waitFor(() => expect(traceDetailsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(traceMetaMock).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText('Errors: 1, Logs: 0, Spans: 2, Metrics: 0')
    ).toBeInTheDocument();
  });

  it('shows an error state when expanded sample trace meta fails to load', async () => {
    const metricFixtures = createTraceMetricFixtures(
      organization,
      project,
      TRACE_METRIC_FIXTURE_DATE
    );
    const row = metricFixtures.detailedFixtures[0]!;
    const timestamp = new Date(row.timestamp).getTime() / 1000;
    const traceMetaMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/${organization.slug}/events-trace-meta/${row.trace}/`,
      match: [MockApiClient.matchData({timestamp})],
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
    });

    render(
      <table>
        <tbody>
          <MetricDetails dataRow={row} ref={{current: null}} showTelemetry />
        </tbody>
      </table>,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      }
    );

    await waitFor(() => expect(traceMetaMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Failed to fetch trace summary')).toBeInTheDocument();
    expect(screen.getByText('Attributes')).toBeInTheDocument();
  });

  it('shows an error state when expanded sample details fail to load', () => {
    const metricFixtures = createTraceMetricFixtures(
      organization,
      project,
      TRACE_METRIC_FIXTURE_DATE
    );
    const row = metricFixtures.detailedFixtures[0]!;
    const traceDetailSpy = jest
      .spyOn(useMetricTraceDetailModule, 'useMetricTraceDetail')
      .mockReturnValue({
        data: undefined,
        isError: true,
        isPending: false,
      } as unknown as ReturnType<typeof useMetricTraceDetailModule.useMetricTraceDetail>);

    render(
      <table>
        <tbody>
          <MetricDetails dataRow={row} ref={{current: null}} showTelemetry={false} />
        </tbody>
      </table>,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      }
    );

    expect(screen.getByTestId('error-indicator')).toBeInTheDocument();

    traceDetailSpy.mockRestore();
  });

  it('shows an empty state when expanded sample details have no data', () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    const row = metricFixtures.detailedFixtures[0]!;
    const traceDetailSpy = jest
      .spyOn(useMetricTraceDetailModule, 'useMetricTraceDetail')
      .mockReturnValue({
        data: undefined,
        isError: false,
        isPending: false,
      } as unknown as ReturnType<typeof useMetricTraceDetailModule.useMetricTraceDetail>);

    render(
      <table>
        <tbody>
          <MetricDetails dataRow={row} ref={{current: null}} showTelemetry={false} />
        </tbody>
      </table>,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      }
    );

    expect(screen.getByText('No attributes found for this sample')).toBeInTheDocument();

    traceDetailSpy.mockRestore();
  });

  it('shows an empty state instead of loading when expanded sample details are disabled', () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    const row = {
      ...metricFixtures.detailedFixtures[0]!,
      [TraceMetricKnownFieldKey.ID]: undefined,
    } as unknown as TraceMetricEventsResponseItem;
    const traceDetailSpy = jest
      .spyOn(useMetricTraceDetailModule, 'useMetricTraceDetail')
      .mockReturnValue({
        data: undefined,
        isError: false,
        isLoading: false,
        isPending: true,
      } as unknown as ReturnType<typeof useMetricTraceDetailModule.useMetricTraceDetail>);

    render(
      <table>
        <tbody>
          <MetricDetails dataRow={row} ref={{current: null}} showTelemetry={false} />
        </tbody>
      </table>,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      }
    );

    expect(traceDetailSpy).toHaveBeenCalledWith(
      expect.objectContaining({enabled: false})
    );
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.getByText('No attributes found for this sample')).toBeInTheDocument();

    traceDetailSpy.mockRestore();
  });

  it('shows an empty state when expanded sample details have no attributes', () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    const row = metricFixtures.detailedFixtures[0]!;
    const traceDetailSpy = jest
      .spyOn(useMetricTraceDetailModule, 'useMetricTraceDetail')
      .mockReturnValue({
        data: {
          attributes: [],
          meta: {},
        },
        isError: false,
        isPending: false,
      } as unknown as ReturnType<typeof useMetricTraceDetailModule.useMetricTraceDetail>);

    render(
      <table>
        <tbody>
          <MetricDetails dataRow={row} ref={{current: null}} showTelemetry={false} />
        </tbody>
      </table>,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      }
    );

    expect(screen.getByText('No attributes found for this sample')).toBeInTheDocument();

    traceDetailSpy.mockRestore();
  });
});
