import {Fragment, useMemo} from 'react';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconClock, IconGraph} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {TOP_EVENTS_LIMIT} from 'sentry/views/explore/hooks/useTopEvents';
import {ConfidenceFooter} from 'sentry/views/explore/metrics/confidenceFooter';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {
  useMetricLabel,
  useMetricName,
  useMetricVisualize,
  useMetricVisualizes,
  useSetMetricVisualize,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {METRICS_CHART_GROUP} from 'sentry/views/explore/metrics/metricsTab';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  useQueryParamsQuery,
  useQueryParamsTopEventsLimit,
} from 'sentry/views/explore/queryParams/context';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
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

const MINIMIZED_GRAPH_HEIGHT = 50;
const STACKED_GRAPH_HEIGHT = 362;

interface MetricsGraphProps {
  orientation: TableOrientation;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  additionalActions?: React.ReactNode;
  infoContentHidden?: boolean;
  isMetricOptionsEmpty?: boolean;
}

export function MetricsGraph({
  timeseriesResult,
  orientation,
  additionalActions,
  infoContentHidden,
  isMetricOptionsEmpty,
}: MetricsGraphProps) {
  const organization = useOrganization();
  const metricQueries = useMultiMetricsQueryParams();
  const visualize = useMetricVisualize();
  const visualizes = useMetricVisualizes();
  const setVisualize = useSetMetricVisualize();

  const hasMultiVisualize = organization.features.includes(
    'tracemetrics-overlay-charts-ui'
  );

  useSynchronizeCharts(
    metricQueries.length,
    !timeseriesResult.isPending,
    METRICS_CHART_GROUP
  );

  function handleChartTypeChange(newChartType: ChartType) {
    setVisualize(visualize.replace({chartType: newChartType}));
  }

  return (
    <Graph
      visualize={visualize}
      visualizes={visualizes}
      hasMultiVisualize={hasMultiVisualize}
      timeseriesResult={timeseriesResult}
      onChartTypeChange={handleChartTypeChange}
      orientation={orientation}
      additionalActions={additionalActions}
      infoContentHidden={infoContentHidden}
      isMetricOptionsEmpty={isMetricOptionsEmpty}
    />
  );
}

interface GraphProps extends MetricsGraphProps {
  hasMultiVisualize: boolean;
  onChartTypeChange: (chartType: ChartType) => void;
  visualize: ReturnType<typeof useMetricVisualize>;
  visualizes: ReturnType<typeof useMetricVisualizes>;
}

function Graph({
  onChartTypeChange,
  timeseriesResult,
  orientation,
  visualize,
  visualizes,
  hasMultiVisualize,
  infoContentHidden,
  additionalActions,
  isMetricOptionsEmpty,
}: GraphProps) {
  const aggregate = visualize.yAxis;
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const metricLabel = useMetricLabel();
  const metricName = useMetricName();
  const userQuery = useQueryParamsQuery();
  const [interval, setInterval, intervalOptions] = useChartInterval();

  const chartInfo = useMemo(() => {
    const isTopEvents = defined(topEventsLimit);
    const yAxes = hasMultiVisualize ? visualizes.map(v => v.yAxis) : [visualize.yAxis];
    const rawSeries = yAxes.flatMap(yAxis => timeseriesResult.data[yAxis] ?? []);

    // When displaying multiple aggregates, simplify the legend labels
    // to just show the function name (e.g., "p50" instead of "p50(metric.name)")
    // For series with groupBy, show "groupByValue : functionName"
    let series = rawSeries;
    if (hasMultiVisualize && visualizes.length > 1) {
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
      topEvents: isTopEvents ? TOP_EVENTS_LIMIT : undefined,
    };
  }, [
    visualize.chartType,
    visualize.yAxis,
    timeseriesResult,
    aggregate,
    topEventsLimit,
    hasMultiVisualize,
    visualizes,
  ]);

  const chartTitle = useMemo(() => {
    if (hasMultiVisualize && visualizes.length > 1) {
      return metricName;
    }
    return metricLabel ?? prettifyAggregation(aggregate) ?? aggregate;
  }, [aggregate, hasMultiVisualize, metricLabel, metricName, visualizes.length]);

  const Title = <Widget.WidgetTitle title={chartTitle} />;

  const chartIcon =
    visualize.chartType === ChartType.LINE
      ? 'line'
      : visualize.chartType === ChartType.AREA
        ? 'area'
        : 'bar';

  const Actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconGraph type={chartIcon} />}
              borderless
              showChevron={false}
              size="xs"
            />
          )}
          value={visualize.chartType}
          menuTitle="Type"
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={option => onChartTypeChange(option.value)}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          value={interval}
          onChange={({value}) => setInterval(value)}
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconClock />}
              borderless
              showChevron={false}
              size="xs"
            />
          )}
          menuTitle="Interval"
          options={intervalOptions}
        />
      </Tooltip>
      {additionalActions}
    </Fragment>
  );

  const showEmptyState = isMetricOptionsEmpty && visualize.visible;
  const showChart = visualize.visible && !isMetricOptionsEmpty;

  return (
    <WidgetWrapper hideFooterBorder={orientation === 'bottom'}>
      <Widget
        Title={Title}
        Actions={Actions}
        Visualization={
          showEmptyState ? (
            <GenericWidgetEmptyStateWarning
              message={tct(
                'No metrics found for this time period. If this is unexpected, try updating your filters or [link:learn more] about how to use metrics.',
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
          showChart && (
            <ConfidenceFooter
              chartInfo={chartInfo}
              isLoading={timeseriesResult.isFetching}
              hasUserQuery={!!userQuery}
            />
          )
        }
        height={
          visualize.visible
            ? orientation === 'bottom' || infoContentHidden
              ? STACKED_GRAPH_HEIGHT
              : undefined
            : MINIMIZED_GRAPH_HEIGHT
        }
        revealActions="always"
        borderless
      />
    </WidgetWrapper>
  );
}
