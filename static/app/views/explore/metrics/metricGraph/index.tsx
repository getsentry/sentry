import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import type {Selection} from 'sentry/components/charts/useChartXRangeSelection';
import {IconClock, IconClose, IconGraph} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import {ConfidenceFooter} from 'sentry/views/explore/metrics/confidenceFooter';
import type {TableOrientation} from 'sentry/views/explore/metrics/hooks/useOrientationControl';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import type {TracePeriod} from 'sentry/views/explore/metrics/metricsFrozenContext';
import {
  useMetricLabel,
  useMetricName,
  useMetricVisualize,
  useMetricVisualizes,
  useSetMetricVisualizes,
  useTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {METRICS_CHART_GROUP} from 'sentry/views/explore/metrics/metricsTab';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {getTracePeriodFromSelection} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsQuery,
  useQueryParamsTopEventsLimit,
} from 'sentry/views/explore/queryParams/context';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {getVisualizeLabel} from 'sentry/views/explore/toolbar/toolbarVisualize';
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

const MINIMIZED_GRAPH_HEIGHT = 50;
const STACKED_GRAPH_HEIGHT = 362;

interface MetricsGraphProps {
  orientation: TableOrientation;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  additionalActions?: React.ReactNode;
  infoContentHidden?: boolean;
  isMetricOptionsEmpty?: boolean;
  onTableSelectionChange?: (
    selection: Selection | null,
    tracePeriod?: TracePeriod
  ) => void;
  queryIndex?: number;
  tableSelection?: Selection | null;
}

export function MetricsGraph({
  timeseriesResult,
  orientation,
  queryIndex = 0,
  additionalActions,
  infoContentHidden,
  isMetricOptionsEmpty,
  tableSelection,
  onTableSelectionChange,
}: MetricsGraphProps) {
  const metricQueries = useMultiMetricsQueryParams();
  const visualize = useMetricVisualize();
  const visualizes = useMetricVisualizes();
  const setVisualizes = useSetMetricVisualizes();

  useSynchronizeCharts(
    metricQueries.length,
    !timeseriesResult.isPending,
    METRICS_CHART_GROUP
  );

  function handleChartTypeChange(newChartType: ChartType) {
    setVisualizes(visualizes.map(v => v.replace({chartType: newChartType})));
  }

  return (
    <Graph
      visualize={visualize}
      visualizes={visualizes}
      timeseriesResult={timeseriesResult}
      onChartTypeChange={handleChartTypeChange}
      orientation={orientation}
      additionalActions={additionalActions}
      infoContentHidden={infoContentHidden}
      isMetricOptionsEmpty={isMetricOptionsEmpty}
      queryIndex={queryIndex}
      tableSelection={tableSelection}
      onTableSelectionChange={onTableSelectionChange}
    />
  );
}

interface GraphProps extends MetricsGraphProps {
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
  infoContentHidden,
  additionalActions,
  isMetricOptionsEmpty,
  queryIndex = 0,
  tableSelection,
  onTableSelectionChange,
}: GraphProps) {
  const organization = useOrganization();
  const hasMetricsUIRefresh = canUseMetricsUIRefresh(organization);
  const aggregate = visualize.yAxis;
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const metricLabel = useMetricLabel();
  const metricName = useMetricName();
  const userQuery = useQueryParamsQuery();
  const [interval, setInterval, intervalOptions] = useChartInterval();
  const traceMetric = useTraceMetric();
  const rawMetricCounts = useRawCounts({
    dataset: DiscoverDatasets.TRACEMETRICS,
    aggregate: `count(value,${traceMetric.name},${traceMetric.type},${traceMetric.unit ?? '-'})`,
    enabled: Boolean(traceMetric.name),
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
    return metricLabel ?? prettifyAggregation(aggregate) ?? aggregate;
  }, [aggregate, metricLabel, metricName, visualizes.length]);

  const Title = hasMetricsUIRefresh ? (
    <Flex align="center" gap="xs">
      <VisualizeLabel
        justify="center"
        align="center"
        radius="md"
        paddingLeft="sm"
        paddingRight="sm"
        paddingTop="xs"
        paddingBottom="xs"
      >
        <Text bold variant="accent">
          {getVisualizeLabel(queryIndex)}
        </Text>
      </VisualizeLabel>
      <Widget.WidgetTitle title={chartTitle} />
    </Flex>
  ) : (
    <Widget.WidgetTitle title={chartTitle} />
  );

  const chartIcon =
    visualize.chartType === ChartType.LINE
      ? 'line'
      : visualize.chartType === ChartType.AREA
        ? 'area'
        : 'bar';

  const Actions = (
    <Fragment>
      <CompactSelect
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            tooltipProps={{
              title: t('Type of chart displayed in this visualization (ex. line)'),
            }}
            icon={<IconGraph type={chartIcon} />}
            priority="transparent"
            showChevron={false}
            size="xs"
          />
        )}
        value={visualize.chartType}
        menuTitle="Type"
        options={EXPLORE_CHART_TYPE_OPTIONS}
        onChange={option => onChartTypeChange(option.value)}
      />
      <CompactSelect
        value={interval}
        onChange={({value}) => setInterval(value)}
        trigger={triggerProps => (
          <OverlayTrigger.Button
            tooltipProps={{
              title: t('Time interval displayed in this visualization (ex. 5m)'),
            }}
            {...triggerProps}
            icon={<IconClock />}
            priority="transparent"
            showChevron={false}
            size="xs"
          />
        )}
        menuTitle="Interval"
        options={intervalOptions}
      />
      {hasMetricsUIRefresh && tableSelection ? (
        <Button
          aria-label={t('Clear table time range')}
          icon={<IconClose />}
          priority="transparent"
          size="xs"
          onClick={() => onTableSelectionChange?.(null)}
        />
      ) : null}
      {additionalActions}
    </Fragment>
  );

  const showEmptyState = isMetricOptionsEmpty && visualize.visible;
  const showChart = visualize.visible && !isMetricOptionsEmpty;

  let height: number | undefined = MINIMIZED_GRAPH_HEIGHT;
  if (visualize.visible) {
    if (orientation === 'bottom' || infoContentHidden) {
      height = STACKED_GRAPH_HEIGHT;
    } else if (hasMetricsUIRefresh) {
      height = STACKED_GRAPH_HEIGHT;
    } else {
      height = undefined;
    }
  }

  return (
    <WidgetWrapper hideFooterBorder={orientation === 'bottom' || hasMetricsUIRefresh}>
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
            <ChartVisualization
              chartInfo={chartInfo}
              chartXRangeSelection={
                hasMetricsUIRefresh
                  ? {
                      disabled: false,
                      initialSelection: tableSelection ?? undefined,
                      onSelectionEnd: ({selectionState}) => {
                        if (!selectionState) {
                          return;
                        }

                        onTableSelectionChange?.(
                          selectionState.selection,
                          getTracePeriodFromSelection(selectionState.selection)
                        );
                      },
                      onClearSelection: () => {
                        onTableSelectionChange?.(null);
                      },
                    }
                  : undefined
              }
            />
          ) : undefined
        }
        Footer={
          showChart && (
            <ConfidenceFooter
              chartInfo={chartInfo}
              isLoading={timeseriesResult.isFetching}
              hasUserQuery={!!userQuery}
              rawMetricCounts={rawMetricCounts}
            />
          )
        }
        height={height}
        revealActions="always"
        borderless
      />
    </WidgetWrapper>
  );
}

const VisualizeLabel = styled(Flex)`
  background-color: ${p => p.theme.tokens.background.transparent.accent.muted};
`;
