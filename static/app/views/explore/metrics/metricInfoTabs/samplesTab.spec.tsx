import type {ReactNode} from 'react';
import {initializeTraceMetricsTest} from 'sentry-fixture/tracemetrics';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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

  const pointId = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const rows = [
    {
      id: 'a',
      'project.id': project.id,
      trace: '',
      span_id: '',
      'metric.name': traceMetric.name,
      'metric.type': 'histogram',
      timestamp: new Date().toISOString(),
      value: 7.5,
      row_kind: 'bucket',
      'bucket.lower': 5,
      'bucket.upper': 10,
      'bucket.count': 3,
      point_id: pointId,
    },
    {
      id: 'b',
      'project.id': project.id,
      trace: 'aaaabbbbccccddddeeeeffff00001111',
      span_id: 'aaaabbbbccccdddd',
      'metric.name': traceMetric.name,
      'metric.type': 'histogram',
      timestamp: new Date().toISOString(),
      value: 8,
      row_kind: 'exemplar',
      point_id: pointId,
    },
  ] as unknown as TraceMetricEventsResponseItem[];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupPageFilters();
  });

  it('shows histogram columns and filters by exemplars and point id', async () => {
    const eventsMock = setupEventsMock(rows, [
      MockApiClient.matchQuery({referrer: 'api.explore.metric-samples-table'}),
    ]);

    render(<SamplesTab traceMetric={traceMetric} />, {
      organization,
      additionalWrapper: Wrapper,
    });

    expect(await screen.findByText('(5, 10]')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Row Kind'})).toBeInTheDocument();
    expect(screen.getByRole('columnheader', {name: 'Point ID'})).toBeInTheDocument();
    // only the exemplar row links to its trace
    expect(screen.getByRole('link', {name: 'aaaabbbb'})).toBeInTheDocument();

    const [firstCall] = eventsMock.mock.calls;
    expect(firstCall[1].query.field).toEqual(
      expect.arrayContaining(['row_kind', 'bucket.lower', 'bucket.upper', 'point_id'])
    );

    await userEvent.click(screen.getByRole('checkbox', {name: 'Exemplars only'}));
    await waitFor(() =>
      expect(eventsMock).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('row_kind:exemplar'),
          }),
        })
      )
    );

    await userEvent.click(screen.getAllByRole('button', {name: pointId.slice(0, 8)})[0]!);
    await waitFor(() =>
      expect(eventsMock).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining(`point_id:${pointId}`),
          }),
        })
      )
    );
  });
});
