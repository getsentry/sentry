import {Fragment, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {IconClock} from '@sentry/icons/clock';
import {IconContract} from '@sentry/icons/contract';
import {IconExpand} from '@sentry/icons/expand';
import {IconGraph} from '@sentry/icons/graph';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack, type ContainerProps} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DroppedDataFilterNote} from 'sentry/components/droppedData/droppedDataFilterNote';
import {DroppedDataLayerControl} from 'sentry/components/droppedData/droppedDataLayerControl';
import {DroppedDataLLMContext} from 'sentry/components/droppedData/droppedDataLLMContext';
import {useDroppedDataLayer} from 'sentry/components/droppedData/useDroppedDataLayer';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {getAnomalyDetectionDisabledReason} from 'sentry/utils/anomalyDetection/getAnomalyDetectionDisabledReason';
import {getAnomalyScoringWarning} from 'sentry/utils/anomalyDetection/getAnomalyScoringPlan';
import {defined} from 'sentry/utils/defined';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/utils/timeSeries/determineSeriesSampleCount';
import {getTimeSeriesForQuery} from 'sentry/utils/timeSeries/getTimeSeriesForQuery';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {
  AnomalyMarkers,
  makeAnomalyTooltipDetails,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/anomalyMarkers';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useChartSelection} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {CHART_SELECTION_ALERT_KEY} from 'sentry/views/explore/components/attributeBreakdowns/constants';
import {FloatingTrigger} from 'sentry/views/explore/components/attributeBreakdowns/floatingTrigger';
import {
  ChartVisualization,
  useChartInfosPlottables,
} from 'sentry/views/explore/components/chart/chartVisualization';
import {SamplingWarning} from 'sentry/views/explore/components/chart/samplingWarning';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {ChartContextMenu} from 'sentry/views/explore/components/chartContextMenu';
import {
  AddTransformationButton,
  AnomaliesTransformationRow,
  VisualizeTransformationRows,
  type AnomaliesToggle,
} from 'sentry/views/explore/components/toolbar/toolbarVisualize/visualizeTransformations';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  useExploreAnomalies,
  type ExploreAnomaliesStatus,
} from 'sentry/views/explore/hooks/useExploreAnomalies';
import {
  type RPCQueryExtras,
  type SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {useQueryParamsGroupBys} from 'sentry/views/explore/queryParams/context';
import {
  groupVisualizes,
  serializeVisualizes,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import {CHART_HEIGHT} from 'sentry/views/explore/settings';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';
import {
  combineConfidenceForSeries,
  getSamplingWarningReason,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
import {
  getConditionalFilterInvalidSeriesMessageForYAxis,
  isConditionalAggregateYAxisValid,
} from 'sentry/views/explore/utils/conditionalAggregate';
import {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import type {SortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

import {ConfidenceFooter} from './confidenceFooter';

interface ExploreChartsProps {
  extrapolate: boolean;
  query: string;
  rawSpanCounts: RawCounts;
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  timeseriesResult: SortedTimeSeries;
  visualizes: readonly Visualize[];
  /**
   * Extras sent with the main timeseries query, reused for the anomaly history
   */
  queryExtras?: RPCQueryExtras;
  samplingMode?: SamplingMode;
}

export const EXPLORE_CHART_TYPE_OPTIONS = [
  {
    value: ChartType.LINE,
    label: t('Line'),
  },
  {
    value: ChartType.AREA,
    label: t('Area'),
  },
  {
    value: ChartType.BAR,
    label: t('Bar'),
  },
];

const EXPLORE_CHART_GROUP = 'explore-charts_group';

const ANOMALY_STATUS_NOTES: Record<ExploreAnomaliesStatus, string | undefined> = {
  idle: undefined,
  loading: t('Detecting anomalies…'),
  empty: t('Needs at least 7 days of history'),
  error: t("Couldn't detect anomalies"),
  ready: undefined,
};

// Several aggregates over the top groups can share a chart, which can put
// dozens of series in one tooltip.
const MAX_TOOLTIP_SERIES = 10;

export function ExploreCharts({
  query,
  extrapolate,
  rawSpanCounts,
  timeseriesResult,
  visualizes,
  setVisualizes,
  samplingMode,
  queryExtras,
}: ExploreChartsProps) {
  const topEvents = useTopEvents();

  function updateVisualizes(
    indices: number[],
    options: {
      chartType?: ChartType;
      transformations?: readonly string[];
      visible?: boolean;
    }
  ) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (indices.includes(i)) {
        visualize = visualize.replace(options);
      }
      return visualize;
    });
    setVisualizes(serializeVisualizes(newVisualizes));
  }

  // Aggregates selected together in the toolbar share a chart and Y axis.
  const chartGroups = useMemo(() => groupVisualizes(visualizes), [visualizes]);

  // Each chart remounts when its function or attribute changes (see its key),
  // so whether it shows anomalies is kept here, by chart position, to survive
  // that swap.
  const [anomalyChartIndices, setAnomalyChartIndices] = useState<ReadonlySet<number>>(
    () => new Set()
  );
  function setShowAnomalies(index: number, show: boolean) {
    setAnomalyChartIndices(current => {
      const next = new Set(current);
      if (show) {
        next.add(index);
      } else {
        next.delete(index);
      }
      return next;
    });
  }

  useSynchronizeCharts(
    chartGroups.length,
    !timeseriesResult.isPending,
    EXPLORE_CHART_GROUP
  );

  const dataset = useSpansDataset();

  return (
    <ChartList>
      <DroppedDataLLMContext dataset={dataset} />
      <WidgetSyncContextProvider groupName={EXPLORE_CHART_GROUP}>
        {chartGroups.map(group => {
          const indices = group.visualizes.map((_, i) => group.index + i);
          return (
            <Chart
              key={`${group.index}-${group.visualizes.map(v => v.yAxis).join(',')}`}
              extrapolate={extrapolate}
              index={group.index}
              onChartTypeChange={chartType => updateVisualizes(indices, {chartType})}
              onChartVisibilityChange={visible => updateVisualizes(indices, {visible})}
              onShowAnomaliesChange={show => setShowAnomalies(group.index, show)}
              onTransformationsChange={transformations =>
                updateVisualizes(indices, {transformations})
              }
              query={query}
              queryExtras={queryExtras}
              showAnomalies={anomalyChartIndices.has(group.index)}
              timeseriesResult={timeseriesResult}
              visualizes={group.visualizes}
              samplingMode={samplingMode}
              topEvents={topEvents}
              rawSpanCounts={rawSpanCounts}
            />
          );
        })}
      </WidgetSyncContextProvider>
    </ChartList>
  );
}

function getChartInfo({
  samplingMode,
  timeseriesResult,
  topEvents,
  visualize,
}: {
  timeseriesResult: SortedTimeSeries;
  visualize: Visualize;
  samplingMode?: SamplingMode;
  topEvents?: number;
}): ChartInfo {
  const isTopN = defined(topEvents) && topEvents > 0;
  const series = getTimeSeriesForQuery(
    timeseriesResult.data,
    visualize.yAxis,
    visualize.transformations
  );

  let confidenceSeries = series;

  let samplingMeta = determineSeriesSampleCountAndIsSampled(confidenceSeries, isTopN);

  // This implies that the sampling meta data is not available.
  // When this happens, we override it with the sampling meta
  // data from the DEFAULT_VISUALIZATION.
  if (samplingMeta.sampleCount === 0 && !defined(samplingMeta.isSampled)) {
    confidenceSeries = getTimeSeriesForQuery(
      timeseriesResult.data,
      DEFAULT_VISUALIZATION,
      []
    );
    samplingMeta = determineSeriesSampleCountAndIsSampled(confidenceSeries, isTopN);
  }

  // Invalid `_if` filters skip the backend request; surface that as a chart error
  // instead of an empty/no-data state.
  const hasValidConditionalFilter = isConditionalAggregateYAxisValid(visualize.yAxis);
  const resultForChart = (
    hasValidConditionalFilter
      ? timeseriesResult
      : {
          ...timeseriesResult,
          error: new Error(
            getConditionalFilterInvalidSeriesMessageForYAxis(visualize.yAxis)
          ),
          isError: true,
          isPending: false,
          isLoading: false,
          isFetching: false,
          isSuccess: false,
          status: 'error' as const,
        }
  ) as SortedTimeSeries;

  return {
    chartType: visualize.chartType,
    confidence: combineConfidenceForSeries(confidenceSeries),
    series: hasValidConditionalFilter ? series : [],
    timeseriesResult: resultForChart,
    yAxis: visualize.yAxis,
    dataScanned: samplingMeta.dataScanned,
    isSampled: samplingMeta.isSampled,
    sampleCount: samplingMeta.sampleCount,
    samplingMode,
  };
}

/**
 * Merges the chart info of several visualizes plotted on the same chart. All
 * visualizes come from the same timeseries request, so the sampling metadata
 * of the first one is representative of the whole chart.
 */
function combineChartInfos(chartInfos: ChartInfo[]): ChartInfo {
  const first = chartInfos[0]!;
  return {
    ...first,
    series: chartInfos.flatMap(chartInfo => chartInfo.series),
    // Only surface an error when none of the visualizes can be plotted.
    timeseriesResult:
      chartInfos.find(chartInfo => !chartInfo.timeseriesResult.error)?.timeseriesResult ??
      first.timeseriesResult,
  };
}

interface ChartProps {
  extrapolate: boolean;
  index: number;
  onChartTypeChange: (chartType: ChartType) => void;
  onChartVisibilityChange: (visible: boolean) => void;
  onShowAnomaliesChange: (show: boolean) => void;
  onTransformationsChange: (transformations: readonly string[]) => void;
  query: string;
  rawSpanCounts: RawCounts;
  /**
   * Whether anomalies are turned on for this chart
   */
  showAnomalies: boolean;
  timeseriesResult: SortedTimeSeries;
  /**
   * The visualizes plotted on this chart.
   */
  visualizes: readonly Visualize[];
  queryExtras?: RPCQueryExtras;
  samplingMode?: SamplingMode;
  topEvents?: number;
}

function Chart({
  extrapolate,
  index,
  onChartTypeChange,
  onChartVisibilityChange,
  onShowAnomaliesChange,
  onTransformationsChange,
  query,
  queryExtras,
  rawSpanCounts,
  showAnomalies,
  visualizes,
  timeseriesResult,
  samplingMode,
  topEvents,
}: ChartProps) {
  // Every visualize in a chart shares the chart type and visibility, so the
  // first one is used to read them.
  const visualize = visualizes[0]!;

  const organization = useOrganization();
  const theme = useTheme();
  const showTransformationControls =
    visualize.visible &&
    visualize.chartType !== ChartType.HEATMAP &&
    organization.features.includes('explore-interpolation-and-smoothing');
  const {chartSelection, setChartSelection} = useChartSelection();
  const [tab] = useTab();
  const isAttributeBreakdown = tab === Tab.ATTRIBUTE_BREAKDOWNS;
  const {selection} = usePageFilters();
  const groupBys = useQueryParamsGroupBys();
  const [interval, setInterval, intervalOptions] = useChartInterval();
  const dataset = useSpansDataset();
  const droppedData = useDroppedDataLayer({dataset, interval});

  const anomaliesDisabledReason = getAnomalyDetectionDisabledReason({
    datetime: selection.datetime,
    groupBys,
    projects: selection.projects,
    transformations: visualize.transformations,
    yAxisCount: visualizes.length,
  });

  const {
    dismiss: dismissChartSelectionAlert,
    isDismissed: isChartSelectionAlertDismissed,
  } = useDismissAlert({
    key: CHART_SELECTION_ALERT_KEY,
  });

  const chartHeight = visualize.visible ? CHART_HEIGHT : 50;

  const chartRef = useRef<ReactEchartsRef>(null);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);

  const chartType = visualize.chartType;
  const isCombinedChart = visualizes.length > 1;
  const chartIcon =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  const chartInfos = useMemo(
    () =>
      visualizes.map(v => ({
        ...getChartInfo({visualize: v, timeseriesResult, topEvents, samplingMode}),
        // A combined chart has a single chart type control, so every
        // visualize is drawn with the type it shows.
        chartType,
      })),
    [timeseriesResult, visualizes, samplingMode, topEvents, chartType]
  );

  const chartInfo: ChartInfo = useMemo(
    () => (chartInfos.length === 1 ? chartInfos[0]! : combineChartInfos(chartInfos)),
    [chartInfos]
  );

  const plottables = useChartInfosPlottables(chartInfos);

  const detectedAnomalies = useExploreAnomalies({
    enabled:
      showTransformationControls &&
      showAnomalies &&
      !anomaliesDisabledReason &&
      !chartInfo.timeseriesResult.isError,
    extrapolate,
    isMainChartLoaded: !chartInfo.timeseriesResult.isPending,
    query,
    queryExtras,
    visualize,
  });
  const anomalies: AnomaliesToggle = {
    enabled: showAnomalies,
    onChange: onShowAnomaliesChange,
    disabledReason: anomaliesDisabledReason,
    note: ANOMALY_STATUS_NOTES[detectedAnomalies.status],
    warning: getAnomalyScoringWarning(detectedAnomalies.plan, interval) ?? undefined,
  };

  // Shading is drawn on top of the chart's own series, which load and render
  // without waiting for it.
  const firstPlottable = plottables[0];
  const plottablesWithAnomalies = useMemo(
    () =>
      firstPlottable && detectedAnomalies.anomalyPeriods.length > 0
        ? [
            ...plottables,
            new AnomalyMarkers({
              periods: detectedAnomalies.anomalyPeriods,
              dataType: firstPlottable.dataType,
              dataUnit: firstPlottable.dataUnit,
            }),
          ]
        : plottables,
    [detectedAnomalies.anomalyPeriods, firstPlottable, plottables]
  );
  const renderAnomalyTooltipDetails = useMemo(
    () =>
      makeAnomalyTooltipDetails({
        bucketMs: intervalToMilliseconds(interval),
        periods: detectedAnomalies.anomalyPeriods,
        theme,
        utc: selection.datetime.utc ?? false,
      }),
    [interval, detectedAnomalies.anomalyPeriods, selection.datetime.utc, theme]
  );

  const Title = (
    <Widget.WidgetTitle
      summary={
        !visualize.visible && plottablesCanBeVisualized(plottables) ? (
          <TimeSeriesWidgetVisualization
            plottables={plottables}
            showLegend="never"
            showXAxis="never"
            showYAxis="never"
          />
        ) : null
      }
      title={visualizes.map(v => prettifyAggregation(v.yAxis) ?? v.yAxis).join(', ')}
    />
  );

  const samplingWarnings = chartInfos.flatMap(info => {
    const reason = getSamplingWarningReason(info.yAxis, info.series, info.dataScanned);
    return reason ? [{yAxis: info.yAxis, reason}] : [];
  });
  const TitleBadges = samplingWarnings.length ? (
    <Fragment>
      {samplingWarnings.map(({yAxis, reason}, i) => (
        <SamplingWarning key={`${yAxis}-${i}`} yAxis={yAxis} reason={reason} />
      ))}
    </Fragment>
  ) : null;

  const Actions = visualize.visible ? (
    <Fragment>
      {droppedData.layerControl ? (
        <DroppedDataLayerControl {...droppedData.layerControl} />
      ) : null}
      <Tooltip
        title={
          isCombinedChart
            ? t('Charts with multiple aggregates are always displayed as line charts')
            : t('Type of chart displayed in this visualization (ex. line)')
        }
      >
        <CompactSelect
          disabled={isCombinedChart}
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              aria-label={t('Chart type')}
              icon={<IconGraph type={chartIcon} />}
              variant="transparent"
              showChevron={false}
              size="xs"
            />
          )}
          value={chartType}
          menuTitle="Type"
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={option => onChartTypeChange(option.value)}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          value={interval}
          onChange={option => setInterval(option.value)}
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
              icon={<IconClock />}
              variant="transparent"
              showChevron={false}
              size="xs"
            />
          )}
          menuTitle="Interval"
          options={intervalOptions}
        />
      </Tooltip>
      <ChartContextMenu
        key="context"
        visualizeYAxes={visualizes}
        query={query}
        interval={interval}
        visualizeIndex={index}
      />
      <Button
        aria-label={t('Collapse chart')}
        icon={<IconContract />}
        onClick={() => onChartVisibilityChange(false)}
        size="xs"
      />
    </Fragment>
  ) : (
    <Button
      aria-label={t('Expand chart')}
      icon={<IconExpand />}
      onClick={() => onChartVisibilityChange(true)}
      size="xs"
    />
  );

  const initialChartSelection =
    chartSelection?.chartIndex === index ? chartSelection.selection : undefined;

  // ECharts keeps its toolbox zoom window and brush across option merges, so
  // the chart needs a fresh instance whenever the queried range or data changes.
  const {period, start, end} = selection.datetime;
  const chartRemountKey = `${isAttributeBreakdown ? 'attribute-breakdown' : 'zoom'}|${period}|${start}|${end}|${query}|${chartType}|${interval}|${topEvents}|${groupBys.join(',')}`;

  return (
    <ChartWrapper ref={chartWrapperRef} border="primary" radius="md" background="primary">
      <Widget
        Title={Title}
        TitleBadges={TitleBadges}
        Actions={Actions}
        Visualization={
          visualize.visible && (
            <ChartVisualization
              key={chartRemountKey}
              chartInfo={chartInfo}
              chartRef={chartRef}
              plottables={plottablesWithAnomalies}
              renderTooltipDetails={renderAnomalyTooltipDetails}
              tooltipLimit={MAX_TOOLTIP_SERIES}
              droppedData={droppedData.band}
              isDroppedDataLoading={droppedData.isLoading}
              chartXRangeSelection={
                isAttributeBreakdown
                  ? {
                      initialSelection: initialChartSelection,
                      onSelectionEnd: () => {
                        if (!isChartSelectionAlertDismissed) {
                          dismissChartSelectionAlert();
                        }
                      },
                      onInsideSelectionClick: params => {
                        if (!params.selectionState) {
                          return;
                        }

                        params.setSelectionState({
                          ...params.selectionState,
                          isActionMenuVisible: true,
                        });
                      },
                      onOutsideSelectionClick: params => {
                        if (!params.selectionState?.isActionMenuVisible) {
                          return;
                        }

                        params.setSelectionState({
                          ...params.selectionState,
                          isActionMenuVisible: false,
                        });
                      },
                      onClearSelection: () => {
                        setChartSelection(null);
                      },
                      disabled: false,
                      actionMenuRenderer: params => {
                        return <FloatingTrigger chartIndex={index} params={params} />;
                      },
                    }
                  : undefined
              }
            />
          )
        }
        Footer={
          visualize.visible && (
            <Container containerType="inline-size">
              <Flex align="center" justify="between" gap="md">
                <Flex
                  flex="1"
                  minWidth="0"
                  direction={{zero: 'column', xl: 'row'}}
                  align={{zero: 'start', xl: 'center'}}
                  justify="between"
                  gap={{zero: 'xs', xl: 'md'}}
                >
                  <ConfidenceFooter
                    extrapolate={extrapolate}
                    sampleCount={chartInfo.sampleCount}
                    isLoading={chartInfo.timeseriesResult?.isPending || false}
                    isSampled={chartInfo.isSampled}
                    confidence={chartInfo.confidence}
                    topEvents={
                      topEvents
                        ? Math.min(topEvents, chartInfos[0]!.series.length)
                        : undefined
                    }
                    dataScanned={chartInfo.dataScanned}
                    rawSpanCounts={rawSpanCounts}
                    userQuery={query.trim()}
                  />
                  {droppedData.filterNote ? (
                    <DroppedDataFilterNote
                      {...droppedData.filterNote}
                      hasUserQuery={!!query.trim()}
                      showIcon={{zero: false, xl: true}}
                    />
                  ) : null}
                </Flex>
                {showTransformationControls ? (
                  <AddTransformationButton
                    traceItemDataset={TraceItemDataset.SPANS}
                    transformations={visualize.transformations}
                    onChange={onTransformationsChange}
                    anomalies={anomalies}
                  />
                ) : null}
              </Flex>
            </Container>
          )
        }
        height={chartHeight}
        revealActions="always"
        borderless
      />
      {showTransformationControls &&
      (visualize.transformations.length > 0 || anomalies.enabled) ? (
        <Container padding="xl" paddingTop="0" paddingBottom="md">
          <Stack gap="sm">
            <VisualizeTransformationRows
              traceItemDataset={TraceItemDataset.SPANS}
              transformations={visualize.transformations}
              layout="inline"
              onChange={onTransformationsChange}
              anomaliesEnabled={anomalies.enabled}
            />
            {anomalies.enabled ? (
              <AnomaliesTransformationRow anomalies={anomalies} />
            ) : null}
          </Stack>
        </Container>
      ) : null}
    </ChartWrapper>
  );
}

export function ChartWrapper(props: ContainerProps) {
  return <Container minWidth="0" position="relative" {...props} />;
}

export const ChartList = styled('div')`
  position: relative;
  display: grid;
  row-gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;
