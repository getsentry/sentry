import type {ReactNode} from 'react';
import qs from 'query-string';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {
  createTraceMetricFixtures,
  initializeTraceMetricsTest,
} from 'sentry-fixture/tracemetrics';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

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
      features: [...organization.features, 'tracemetrics-equations-in-explore'],
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

  it('links embedded metric names to span samples with a metrics cross-event query', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    const row = metricFixtures.detailedFixtures[0]!;

    render(<MetricsSamplesTable embedded overrideTableData={[row]} />, {
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

    const link = (await screen.findByText('Explore similar spans')).closest('a')!;
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
        referrer: 'trace-metrics-samples-table-similar-spans',
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
  });

  it('does not add the similar spans action to non-embedded samples', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());

    render(
      <MetricsSamplesTable overrideTableData={[metricFixtures.detailedFixtures[0]!]} />,
      {organization, additionalWrapper: createWrapper({queryParams, traceMetric})}
    );

    const samplesTable = await screen.findByRole('table');
    await userEvent.click(within(samplesTable).getByRole('button', {name: 'Actions'}));

    expect(await screen.findByText('Copy to clipboard')).toBeInTheDocument();
    expect(screen.queryByText('Explore similar spans')).not.toBeInTheDocument();
  });

  it('does not add the similar spans action without a complete metric identity', async () => {
    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    const row = {
      ...metricFixtures.detailedFixtures[0]!,
      [TraceMetricKnownFieldKey.METRIC_TYPE]: '',
    } as TraceMetricEventsResponseItem;

    render(<MetricsSamplesTable embedded overrideTableData={[row]} />, {
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
    expect(screen.queryByText('Explore similar spans')).not.toBeInTheDocument();
  });
});
