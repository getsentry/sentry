import type {ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {ChartContextMenu} from 'sentry/views/explore/components/chartContextMenu';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricSaveAs} from 'sentry/views/explore/metrics/metricToolbar/metricSaveAs';
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
import {ToolbarSaveAs} from 'sentry/views/explore/toolbar/toolbarSaveAs';
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

it('disables trace saving when a hidden sibling has transformations', async () => {
  const {router} = render(
    <SpansQueryParamsProvider>
      <ToolbarSaveAs />
      <ChartContextMenu
        interval="1h"
        query=""
        visualizeIndex={0}
        visualizeYAxes={[new VisualizeFunction('count(span.duration)')]}
      />
    </SpansQueryParamsProvider>,
    {
      organization: OrganizationFixture({
        features: ['visibility-explore-view', 'dashboards-edit'],
      }),
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/',
          query: {
            aggregateField: [
              JSON.stringify({yAxes: ['count(span.duration)']}),
              JSON.stringify({...transformedField, visible: false}),
            ],
          },
        },
      },
    }
  );
  expect(screen.getByRole('button', {name: 'Save as'})).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  expect(screen.getByRole('button', {name: 'Chart actions'})).toHaveAttribute(
    'aria-disabled',
    'true'
  );
  await userEvent.click(screen.getByRole('button', {name: 'Save as'}));
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  act(() => {
    router.navigate('/organizations/org-slug/explore/traces/');
  });
  await waitFor(() =>
    expect(screen.getByRole('button', {name: 'Save as'})).toBeEnabled()
  );
  expect(screen.getByRole('button', {name: 'Chart actions'})).toBeEnabled();
});

it('disables metric saving when a later metric row has transformations', () => {
  render(
    <MultiMetricsQueryParamsProvider>
      <MetricSaveAs />
    </MultiMetricsQueryParamsProvider>,
    {
      organization: OrganizationFixture({features: ['tracemetrics-enabled']}),
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/metrics/',
          query: {
            metric: [
              JSON.stringify({...metric, aggregateFields: [{yAxes: ['avg(value)']}]}),
              JSON.stringify(metric),
            ],
          },
        },
      },
    }
  );
  expect(screen.getByRole('button', {name: 'Save as'})).toHaveAttribute(
    'aria-disabled',
    'true'
  );
});
