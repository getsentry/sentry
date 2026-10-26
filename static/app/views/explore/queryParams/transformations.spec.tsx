import type {ReactNode} from 'react';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  MultiMetricsQueryParamsProvider,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  useQueryParamsHasTransformations,
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const transformedField = {
  yAxes: ['avg(span.duration)'],
  transformations: ['fill(locf)', 'smooth(sma,5)'],
};

function LogsWrapper({children}: {children: ReactNode}) {
  return (
    <LogsQueryParamsProvider
      source="location"
      analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

function MetricRow({children}: {children: ReactNode}) {
  const [query] = useMultiMetricsQueryParams();
  return (
    <MetricsQueryParamsProvider
      traceMetric={query!.metric}
      queryParams={query!.queryParams}
      setQueryParams={query!.setQueryParams}
      setTraceMetric={query!.setTraceMetric}
      removeMetric={query!.removeMetric}
    >
      {children}
    </MetricsQueryParamsProvider>
  );
}

function MetricsWrapper({children}: {children: ReactNode}) {
  return (
    <MultiMetricsQueryParamsProvider>
      <MetricRow>{children}</MetricRow>
    </MultiMetricsQueryParamsProvider>
  );
}

const metric = {
  metric: {name: 'test_metric', type: 'distribution'},
  aggregateFields: [transformedField],
};

const signalCases: Array<{
  query: Record<string, string[]>;
  signal: string;
  wrapper: typeof SpansQueryParamsProvider;
}> = [
  {
    signal: 'traces',
    wrapper: SpansQueryParamsProvider,
    query: {aggregateField: [JSON.stringify(transformedField)]},
  },
  {
    signal: 'logs',
    wrapper: LogsWrapper,
    query: {aggregateField: [JSON.stringify(transformedField)]},
  },
  {signal: 'metrics', wrapper: MetricsWrapper, query: {metric: [JSON.stringify(metric)]}},
];

describe('Transformation query params', () => {
  it.each(signalCases)(
    '$signal retains ordered transformations through a URL edit and clears them explicitly',
    async ({signal, wrapper, query}) => {
      const {result} = renderHookWithProviders(
        () => ({
          visualizes: useQueryParamsVisualizes(),
          setVisualizes: useSetQueryParamsVisualizes(),
          hasTransformations: useQueryParamsHasTransformations(),
        }),
        {
          additionalWrapper: wrapper,
          initialRouterConfig: {
            location: {pathname: `/organizations/org-slug/explore/${signal}/`, query},
          },
        }
      );

      expect(result.current.visualizes[0]?.serialize()).toEqual(transformedField);
      expect(result.current.hasTransformations).toBe(true);
      act(() =>
        result.current.setVisualizes([
          result.current.visualizes[0]!.replace({chartType: ChartType.AREA}).serialize(),
        ])
      );
      await waitFor(() =>
        expect(result.current.visualizes[0]?.serialize()).toEqual({
          ...transformedField,
          chartType: ChartType.AREA,
        })
      );

      act(() =>
        result.current.setVisualizes([
          new VisualizeFunction('avg(span.duration)', {transformations: []}).serialize(),
        ])
      );
      await waitFor(() =>
        expect(result.current.visualizes[0]?.serialize()).toEqual({
          yAxes: ['avg(span.duration)'],
        })
      );
      expect(result.current.hasTransformations).toBe(false);
    }
  );
});
