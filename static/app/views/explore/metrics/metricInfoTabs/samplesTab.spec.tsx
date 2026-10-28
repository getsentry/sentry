import type {ReactNode} from 'react';
import {initializeTraceMetricsTest} from 'sentry-fixture/tracemetrics';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SamplesTab} from 'sentry/views/explore/metrics/metricInfoTabs/samplesTab';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import type {TraceMetricEventsResponseItem} from 'sentry/views/explore/metrics/types';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

const traceMetric: TraceMetric = {
  name: 'http.server.duration',
  type: 'histogram',
  unit: 'millisecond',
};

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

function Wrapper({children}: {children: ReactNode}) {
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
}

describe('SamplesTab with histogram metrics', () => {
  const {organization, project, setupPageFilters, setupEventsMock} =
    initializeTraceMetricsTest({orgFeatures: ['tracemetrics-enabled']});

  const exemplarRow = {
    id: 'b',
    'project.id': project.id,
    trace: 'aaaabbbbccccddddeeeeffff00001111',
    span_id: 'aaaabbbbccccdddd',
    'metric.name': traceMetric.name,
    'metric.type': 'histogram',
    timestamp: new Date().toISOString(),
    value: 8,
    row_kind: 'exemplar',
  } as unknown as TraceMetricEventsResponseItem;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupPageFilters();
  });

  it('only requests exemplar rows and links them to their trace', async () => {
    const eventsMock = setupEventsMock(
      [exemplarRow],
      [MockApiClient.matchQuery({referrer: 'api.explore.metric-samples-table'})]
    );

    render(<SamplesTab traceMetric={traceMetric} />, {
      organization,
      additionalWrapper: Wrapper,
    });

    expect(await screen.findByRole('link', {name: 'aaaabbbb'})).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    expect(eventsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: expect.stringContaining('row_kind:exemplar'),
        }),
      })
    );
  });

  it('explains missing exemplars when the histogram has none', async () => {
    setupEventsMock(
      [],
      [MockApiClient.matchQuery({referrer: 'api.explore.metric-samples-table'})]
    );

    render(<SamplesTab traceMetric={traceMetric} />, {
      organization,
      additionalWrapper: Wrapper,
    });

    expect(await screen.findByText('No samples found')).toBeInTheDocument();
    expect(screen.getByText(/This histogram has no exemplars/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Learn more'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/metrics/'
    );
  });
});
