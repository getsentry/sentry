import type {ReactNode} from 'react';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {
  createTraceMetricFixtures,
  initializeTraceMetricsTest,
} from 'sentry-fixture/tracemetrics';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {MetricPanel} from 'sentry/views/explore/metrics/metricPanel';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

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
    body: {
      timeSeries: [TimeSeriesFixture()],
    },
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

  describe('flag OFF (tracemetrics-enabled only)', () => {
    const {
      organization,
      project,
      setupPageFilters,
      setupEventsMock,
      setupTraceItemsMock,
    } = initializeTraceMetricsTest({
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
      render(<MetricPanel traceMetric={traceMetric} queryIndex={0} />, {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      });

      expect(await screen.findByTestId('metric-panel')).toBeInTheDocument();
    });

    it('does not render the visualize label badge', async () => {
      render(<MetricPanel traceMetric={traceMetric} queryIndex={0} />, {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      });

      await waitFor(() => {
        expect(screen.getByTestId('metric-panel')).toBeInTheDocument();
      });

      // The visualize label badge ("A") should NOT be present
      expect(screen.queryByText('A')).not.toBeInTheDocument();
    });
  });

  describe('flag ON (tracemetrics-enabled + tracemetrics-ui-refresh)', () => {
    const {
      organization,
      project,
      setupPageFilters,
      setupEventsMock,
      setupTraceItemsMock,
    } = initializeTraceMetricsTest({
      orgFeatures: ['tracemetrics-enabled', 'tracemetrics-ui-refresh'],
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
      render(<MetricPanel traceMetric={traceMetric} queryIndex={0} />, {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      });

      expect(await screen.findByTestId('metric-panel')).toBeInTheDocument();
    });

    it('renders the visualize label badge', async () => {
      render(<MetricPanel traceMetric={traceMetric} queryIndex={0} />, {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      });

      // The visualize label badge "A" (from getVisualizeLabel(0)) should be present
      expect(await screen.findByText('A')).toBeInTheDocument();
    });

    it('does not render orientation controls', async () => {
      render(<MetricPanel traceMetric={traceMetric} queryIndex={0} />, {
        organization,
        additionalWrapper: createWrapper({queryParams, traceMetric}),
      });

      await waitFor(() => {
        expect(screen.getByTestId('metric-panel')).toBeInTheDocument();
      });

      // Orientation controls should NOT be present in the refreshed UI
      expect(
        screen.queryByRole('button', {name: 'Table bottom'})
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Table right'})).not.toBeInTheDocument();
    });
  });
});
