import {useMemo} from 'react';

import {ExternalLink} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import {ConfidenceFooter} from 'sentry/views/explore/metrics/confidenceFooter';
import {canUseMetricsHeatMap} from 'sentry/views/explore/metrics/metricsFlags';
import {
  useMetricLabel,
  useMetricName,
  useMetricVisualize,
  useMetricVisualizes,
  useTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {METRICS_CHART_GROUP} from 'sentry/views/explore/metrics/metricsTab';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  MINIMIZED_GRAPH_HEIGHT,
  STACKED_GRAPH_HEIGHT,
} from 'sentry/views/explore/metrics/settings';
import {
  createTraceMetricEventsFilter,
  getEquationMetricsTotalFilter,
} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsQuery,
  useQueryParamsTopEventsLimit,
} from 'sentry/views/explore/queryParams/context';
import {isVisualizeEquation} from 'sentry/views/explore/queryParams/visualize';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {useRawCounts} from 'sentry/views/explore/useRawCounts';
import {
  combineConfidenceForSeries,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
import {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

import {WidgetWrapper} from './styles';

export function getMetricsChartTypeOptions(organization: Organization) {
  if (canUseMetricsHeatMap(organization)) {
    return [
      ...EXPLORE_CHART_TYPE_OPTIONS,
      {value: ChartType.HEATMAP, label: t('Heat Map')},
    ];
  }
  return EXPLORE_CHART_TYPE_OPTIONS;
}

interface MetricsGraphProps {
  actions: React.ReactNode;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  isMetricOptionsEmpty?: boolean;
  title?: string;
}

export function MetricsGraph({
  timeseriesResult,
  actions,
  isMetricOptionsEmpty,
  title,
}: MetricsGraphProps) {
  const metricQueries = useMultiMetricsQueryParams();
  const visualize = useMetricVisualize();
  const visualizes = useMetricVisualizes();

  useSynchronizeCharts(
    metricQueries.length,
    !timeseriesResult.isPending,
    METRICS_CHART_GROUP
  );

  return (
    <Graph
      visualize={visualize}
      visualizes={visualizes}
      timeseriesResult={timeseriesResult}
      actions={actions}
      isMetricOptionsEmpty={isMetricOptionsEmpty}
      title={title}
    />
  );
}

interface GraphProps {
  actions: React.ReactNode;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  visualize: ReturnType<typeof useMetricVisualize>;
  visualizes: ReturnType<typeof useMetricVisualizes>;
  isMetricOptionsEmpty?: boolean;
  title?: string;
}

function Graph({
  timeseriesResult,
  visualize,
  visualizes,
  actions,
  isMetricOptionsEmpty,
  title,
}: GraphProps) {
  const aggregate = visualize.yAxis;
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const metricLabel = useMetricLabel();
  const metricName = useMetricName();
  const userQuery = useQueryParamsQuery();
  const traceMetric = useTraceMetric();
  const rawMetricCounts = useRawCounts({
    dataset: DiscoverDatasets.TRACEMETRICS,
    enabled:
      Boolean(traceMetric.name) ||
      (isVisualizeEquation(visualize) && Boolean(visualize.expression.text)),
    query: isVisualizeEquation(visualize)
      ? getEquationMetricsTotalFilter(visualize.expression.text)
      : createTraceMetricEventsFilter([traceMetric]),
    normalModeExtrapolated: true,
  });

  const chartInfo = useMemo(() => {
    const isTopEvents = defined(topEventsLimit);
    const yAxes = visualizes.map(v => v.yAxis);
    const rawSeries = yAxes.flatMap(yAxis => timeseriesResult.data[yAxis] ?? []);

    // When displaying multiple aggregates, simplify the legend labels
    // to just show the function name (e.g., "p50" instead of "p50(metric.name)")
    // For series with groupBy, show "groupByValue : functionName"
    let series = rawSeries;
    if (visualizes.length > 1) {
      series = rawSeries.map(s => {
        const parsed = parseFunction(s.yAxis);
        if (!parsed) {
          return s;
        }

        if (s.groupBy?.length) {
          // Build a custom label combining groupBy values and the function name,
          // using the shared formatter to preserve "(no value)" and release formatting.
          // Clear groupBy so formatTimeSeriesLabel uses yAxis instead
          const groupByLabel = formatTimeSeriesLabel(s);
          return {
            ...s,
            yAxis: `${groupByLabel} : ${parsed.name}`,
            groupBy: undefined,
          };
        }

        return {...s, yAxis: parsed.name};
      });
    }

    const samplingMeta = determineSeriesSampleCountAndIsSampled(series, isTopEvents);

    return {
      chartType: visualize.chartType,
      series,
      timeseriesResult,
      yAxis: aggregate,
      confidence: combineConfidenceForSeries(series),
      dataScanned: samplingMeta.dataScanned,
      isSampled: samplingMeta.isSampled,
      sampleCount: samplingMeta.sampleCount,
      samplingMode: undefined,
      topEvents: isTopEvents ? series.filter(s => !s.meta.isOther).length : undefined,
    };
  }, [visualize.chartType, timeseriesResult, aggregate, topEventsLimit, visualizes]);

  const chartTitle = useMemo(() => {
    if (visualizes.length > 1) {
      return metricName;
    }
    return title ?? metricLabel ?? prettifyAggregation(aggregate) ?? aggregate;
  }, [aggregate, metricLabel, metricName, visualizes.length, title]);

  const showEmptyState = isMetricOptionsEmpty && visualize.visible;
  const showChart = visualize.visible && !isMetricOptionsEmpty;

  const height = visualize.visible ? STACKED_GRAPH_HEIGHT : MINIMIZED_GRAPH_HEIGHT;

  return (
    <WidgetWrapper hideFooterBorder>
      <Widget
        Title={<Widget.WidgetTitle title={chartTitle} />}
        Actions={actions}
        Visualization={
          showEmptyState ? (
            <GenericWidgetEmptyStateWarning
              message={tct(
                'No application metrics found for this time period. If this is unexpected, try updating your filters or [link:learn more] about how to use application metrics.',
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/product/explore/metrics/">
                      {t('learn more')}
                    </ExternalLink>
                  ),
                }
              )}
            />
          ) : showChart ? (
            <ChartVisualization chartInfo={chartInfo} />
          ) : undefined
        }
        Footer={
          showChart ? (
            <ConfidenceFooter
              chartInfo={chartInfo}
              isLoading={timeseriesResult.isPending || timeseriesResult.isFetching}
              hasUserQuery={!!userQuery}
              rawMetricCounts={rawMetricCounts}
            />
          ) : undefined
        }
        height={height}
        revealActions="always"
        borderless
      />
    </WidgetWrapper>
  );
}
