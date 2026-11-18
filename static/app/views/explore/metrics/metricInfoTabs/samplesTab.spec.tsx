import type {ReactNode} from 'react';
import {initializeTraceMetricsTest} from 'sentry-fixture/tracemetrics';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

import {SamplesTab} from './samplesTab';

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

function createWrapper(traceMetric: TraceMetric) {
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

describe('SamplesTab', () => {
  const {organization, setupPageFilters, setupEventsMock} = initializeTraceMetricsTest({
    orgFeatures: ['tracemetrics-enabled'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupPageFilters();
  });

  it.each([
    [{name: 'http.server.duration', type: 'histogram', unit: 'millisecond'}, true],
    [{name: 'http.server.duration', type: 'distribution', unit: 'millisecond'}, false],
  ] satisfies Array<[TraceMetric, boolean]>)(
    'only queries exemplars for histograms (%o)',
    async (traceMetric, onlyExemplars) => {
      const eventsMock = setupEventsMock(
        [],
        [MockApiClient.matchQuery({referrer: 'api.explore.metric-samples-table'})]
      );

      render(<SamplesTab traceMetric={traceMetric} />, {
        organization,
        additionalWrapper: createWrapper(traceMetric),
      });

      expect(await screen.findByText('No samples found')).toBeInTheDocument();
      expect(eventsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: onlyExemplars
              ? expect.stringContaining('sentry._internal.row_kind:exemplar')
              : expect.not.stringContaining('sentry._internal.row_kind'),
          }),
        })
      );
    }
  );
});
