import {Fragment, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {parseAsBoolean, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DroppedDataLayerControl} from 'sentry/components/droppedData/droppedDataLayerControl';
import {useDroppedData} from 'sentry/components/droppedData/useDroppedData';
import {useDroppedDataDrawer} from 'sentry/components/droppedData/useDroppedDataDrawer';
import {hasDroppedData} from 'sentry/components/droppedData/utils';
import {IconClock, IconContract, IconExpand, IconGraph} from 'sentry/icons';
import {IconStack} from 'sentry/icons/iconStack';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/utils/timeSeries/determineSeriesSampleCount';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
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
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {type SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {CHART_HEIGHT} from 'sentry/views/explore/settings';
import {ConfidenceFooter} from 'sentry/views/explore/spans/charts/confidenceFooter';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
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

interface ExploreChartsProps {
  extrapolate: boolean;
  query: string;
  rawSpanCounts: RawCounts;
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  timeseriesResult: SortedTimeSeries;
  visualizes: readonly Visualize[];
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

export function ExploreCharts({
  query,
  extrapolate,
  rawSpanCounts,
  timeseriesResult,
  visualizes,
  setVisualizes,
  samplingMode,
}: ExploreChartsProps) {
  const topEvents = useTopEvents();
  const [combineChartsParam, setCombineChartsParam] = useQueryState(
    'combineCharts',
    parseAsBoolean.withDefault(false)
  );

  const canCombineCharts = visualizes.length > 1;
  const combineCharts = canCombineCharts && combineChartsParam;

  function updateVisualizes(
    indices: number[],
    options: {chartType?: ChartType; visible?: boolean}
  ) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (indices.includes(i)) {
        visualize = visualize.replace(options);
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  }

  // When charts are combined, every visualize is plotted on a single chart
  // so they can be compared against a shared Y axis.
  const chartGroups: ChartGroup[] = combineCharts
    ? [{index: 0, visualizes}]
    : visualizes.map((visualize, index) => ({index, visualizes: [visualize]}));

  useSynchronizeCharts(
    chartGroups.length,
    !timeseriesResult.isPending,
    EXPLORE_CHART_GROUP
  );

  return (
    <ChartList>
      <WidgetSyncContextProvider groupName={EXPLORE_CHART_GROUP}>
        {chartGroups.map(group => {
          const indices = group.visualizes.map((_, i) => group.index + i);
          return (
            <Chart
              key={`${group.index}`}
              extrapolate={extrapolate}
              index={group.index}
              onChartTypeChange={chartType => updateVisualizes(indices, {chartType})}
              onChartVisibilityChange={visible => updateVisualizes(indices, {visible})}
              combineCharts={canCombineCharts ? combineCharts : undefined}
              onCombineChartsChange={
                canCombineCharts
                  ? value => setCombineChartsParam(value ? true : null)
                  : undefined
              }
              query={query}
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

interface ChartGroup {
  /**
   * Index of the first visualize in this group.
   */
  index: number;
  visualizes: readonly Visualize[];
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
  const series = timeseriesResult.data[visualize.yAxis] ?? [];

  let confidenceSeries = series;

  let samplingMeta = determineSeriesSampleCountAndIsSampled(confidenceSeries, isTopN);

  // This implies that the sampling meta data is not available.
  // When this happens, we override it with the sampling meta
  // data from the DEFAULT_VISUALIZATION.
  if (samplingMeta.sampleCount === 0 && !defined(samplingMeta.isSampled)) {
    confidenceSeries = timeseriesResult.data[DEFAULT_VISUALIZATION] ?? [];
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
      chartInfos.find(chartInfo => !chartInfo.timeseriesResult.error)
        ?.timeseriesResult ?? first.timeseriesResult,
  };
}

interface ChartProps {
  extrapolate: boolean;
  index: number;
  onChartTypeChange: (chartType: ChartType) => void;
  onChartVisibilityChange: (visible: boolean) => void;
  query: string;
  rawSpanCounts: RawCounts;
  timeseriesResult: SortedTimeSeries;
  visualizes: readonly Visualize[];
  /**
   * Whether all visualizes are plotted on a single chart. Leave undefined
   * when there is nothing to combine.
   */
  combineCharts?: boolean;
  onCombineChartsChange?: (combineCharts: boolean) => void;
  samplingMode?: SamplingMode;
  topEvents?: number;
}

function Chart({
  extrapolate,
  index,
  onChartTypeChange,
  onChartVisibilityChange,
  query,
  rawSpanCounts,
  visualizes,
  timeseriesResult,
  combineCharts,
  onCombineChartsChange,
  samplingMode,
  topEvents,
}: ChartProps) {
  // Every visualize in a chart shares the chart type and visibility, so the
  // first one is used to read them.
  const visualize = visualizes[0]!;

  const {chartSelection, setChartSelection} = useChartSelection();
  const [interval, setInterval, intervalOptions] = useChartInterval();
  const dataset = useSpansDataset();
  const {droppedEvents, acceptedEvents} = useDroppedData({dataset});
  const [isDroppedDataLayerOn, setIsDroppedDataLayerOn] = useState(true);
  const openDroppedDataDrawer = useDroppedDataDrawer(dataset);
  const canShowDroppedData = hasDroppedData(droppedEvents, acceptedEvents);
  const showDroppedDataBand = canShowDroppedData && isDroppedDataLayerOn;

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
  const chartIcon =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  const chartInfos = useMemo(
    () =>
      visualizes.map(v =>
        getChartInfo({visualize: v, timeseriesResult, topEvents, samplingMode})
      ),
    [timeseriesResult, visualizes, samplingMode, topEvents]
  );

  const chartInfo: ChartInfo = useMemo(
    () => (chartInfos.length === 1 ? chartInfos[0]! : combineChartInfos(chartInfos)),
    [chartInfos]
  );

  const plottables = useChartInfosPlottables(chartInfos);

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
      {canShowDroppedData ? (
        <DroppedDataLayerControl
          showDroppedData={isDroppedDataLayerOn}
          onChange={setIsDroppedDataLayerOn}
        />
      ) : null}
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button
              {...triggerProps}
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
      {defined(combineCharts) && onCombineChartsChange ? (
        <Button
          aria-label={combineCharts ? t('Split charts') : t('Combine charts')}
          aria-pressed={combineCharts}
          icon={<IconStack />}
          onClick={() => onCombineChartsChange(!combineCharts)}
          size="xs"
          tooltipProps={{
            title: combineCharts
              ? t('Show each visualization in its own chart')
              : t('Plot all visualizations on a single chart'),
          }}
          variant={combineCharts ? 'primary' : undefined}
        />
      ) : null}
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

  return (
    <ChartWrapper ref={chartWrapperRef}>
      <Widget
        Title={Title}
        TitleBadges={TitleBadges}
        Actions={Actions}
        Visualization={
          visualize.visible && (
            <ChartVisualization
              chartInfo={chartInfo}
              chartRef={chartRef}
              plottables={plottables}
              droppedData={
                showDroppedDataBand
                  ? {
                      droppedEvents,
                      acceptedEvents,
                      onClick: openDroppedDataDrawer,
                    }
                  : undefined
              }
              chartXRangeSelection={{
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
              }}
            />
          )
        }
        Footer={
          visualize.visible && (
            <ConfidenceFooter
              extrapolate={extrapolate}
              sampleCount={chartInfo.sampleCount}
              isLoading={chartInfo.timeseriesResult?.isPending || false}
              isSampled={chartInfo.isSampled}
              confidence={chartInfo.confidence}
              topEvents={
                topEvents ? Math.min(topEvents, chartInfo.series.length) : undefined
              }
              dataScanned={chartInfo.dataScanned}
              rawSpanCounts={rawSpanCounts}
              userQuery={query.trim()}
            />
          )
        }
        height={chartHeight}
        revealActions="always"
      />
    </ChartWrapper>
  );
}

export const ChartWrapper = styled('div')`
  position: relative;
  min-width: 0;
`;

export const ChartList = styled('div')`
  position: relative;
  display: grid;
  row-gap: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;
