import type {ReactNode} from 'react';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {
  createTraceMetricFixtures,
  initializeTraceMetricsTest,
} from 'sentry-fixture/tracemetrics';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import usePageFilters from 'sentry/utils/usePageFilters';
import {AggregatesTab} from 'sentry/views/explore/metrics/metricInfoTabs/aggregatesTab';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

jest.mock('sentry/utils/usePageFilters');

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

describe('AggregatesTab', () => {
  const {organization, project, setupPageFilters, setupEventsMock} =
    initializeTraceMetricsTest({
      orgFeatures: ['tracemetrics-enabled'],
    });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    setupPageFilters();

    // Mock the trace-items attributes endpoint
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders table with only aggregate columns', async () => {
    const traceMetric: TraceMetric = {name: 'test-metric', type: 'distribution'};
    const visualize1 = new VisualizeFunction('avg(value)');
    const visualize2 = new VisualizeFunction('sum(value)');

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [visualize1, visualize2],
      aggregateSortBys: [{field: 'avg(value)', kind: 'desc'}],
    });

    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    setupEventsMock(metricFixtures.detailedFixtures, [
      MockApiClient.matchQuery({
        dataset: 'tracemetrics',
        referrer: 'api.explore.metric-aggregates-table',
      }),
    ]);

    render(<AggregatesTab traceMetric={traceMetric} />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    // Wait for the table to render with header cells
    await waitFor(() => {
      expect(screen.getByRole('columnheader', {name: /avg/i})).toBeInTheDocument();
    });

    // Both aggregate columns should be present
    expect(screen.getByRole('columnheader', {name: /sum/i})).toBeInTheDocument();
  });

  it('renders table with groupBys and aggregate columns', async () => {
    const traceMetric: TraceMetric = {name: 'test-metric', type: 'distribution'};
    const groupBy1: GroupBy = {groupBy: 'environment'};
    const groupBy2: GroupBy = {groupBy: 'service'};
    const visualize1 = new VisualizeFunction('avg(value)');
    const visualize2 = new VisualizeFunction('p95(value)');

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [groupBy1, groupBy2, visualize1, visualize2],
      aggregateSortBys: [{field: 'avg(value)', kind: 'desc'}],
    });

    const metricFixtures = createTraceMetricFixtures(organization, project, new Date());
    setupEventsMock(
      metricFixtures.detailedFixtures.map(f => ({
        ...f,
        environment: 'production',
        service: 'api',
      })),
      [
        MockApiClient.matchQuery({
          dataset: 'tracemetrics',
          referrer: 'api.explore.metric-aggregates-table',
        }),
      ]
    );

    render(<AggregatesTab traceMetric={traceMetric} />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    // Wait for the table to render
    await waitFor(() => {
      expect(
        screen.getByRole('columnheader', {name: /environment/i})
      ).toBeInTheDocument();
    });

    // GroupBy columns
    expect(screen.getByRole('columnheader', {name: /service/i})).toBeInTheDocument();

    // Aggregate columns
    expect(screen.getByRole('columnheader', {name: /avg/i})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: /p95/i})).toBeInTheDocument();
  });

  it('shows empty state when no data is returned', async () => {
    const traceMetric: TraceMetric = {name: 'test-metric', type: 'distribution'};
    const visualize1 = new VisualizeFunction('avg(value)');

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [visualize1],
      aggregateSortBys: [{field: 'avg(value)', kind: 'desc'}],
    });

    // Return empty data
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [],
        meta: {fields: {}, dataScanned: 'full'},
      },
      match: [
        MockApiClient.matchQuery({
          dataset: 'tracemetrics',
          referrer: 'api.explore.metric-aggregates-table',
        }),
      ],
    });

    render(<AggregatesTab traceMetric={traceMetric} />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    // Wait for the empty state
    await waitFor(() => {
      expect(screen.getByText('No aggregates found')).toBeInTheDocument();
    });
  });

  it('shows error state when request fails', async () => {
    const traceMetric: TraceMetric = {name: 'test-metric', type: 'distribution'};
    const visualize1 = new VisualizeFunction('avg(value)');

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [visualize1],
      aggregateSortBys: [{field: 'avg(value)', kind: 'desc'}],
    });

    // Return error response
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
      match: [
        MockApiClient.matchQuery({
          dataset: 'tracemetrics',
          referrer: 'api.explore.metric-aggregates-table',
        }),
      ],
    });

    render(<AggregatesTab traceMetric={traceMetric} />, {
      organization,
      additionalWrapper: createWrapper({queryParams, traceMetric}),
    });

    // Wait for the error state
    await waitFor(() => {
      expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
    });
  });
});
