import {Fragment, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {AttributeComparisonCTA} from 'sentry/views/explore/components/attributeBreakdowns/attributeComparisonCTA';
import {FloatingTrigger} from 'sentry/views/explore/components/attributeBreakdowns/floatingTrigger';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import ChartContextMenu from 'sentry/views/explore/components/chartContextMenu';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useChartBoxSelect} from 'sentry/views/explore/hooks/useChartBoxSelect';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {type SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {Tab} from 'sentry/views/explore/hooks/useTab';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import type {Mode} from 'sentry/views/explore/queryParams/mode';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {CHART_HEIGHT} from 'sentry/views/explore/settings';
import {ConfidenceFooter} from 'sentry/views/explore/spans/charts/confidenceFooter';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';
import {
  combineConfidenceForSeries,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
import {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface ExploreChartsProps {
  confidences: Confidence[];
  extrapolate: boolean;
  query: string;
  rawSpanCounts: RawCounts;
  setTab: (tab: Mode | Tab) => void;
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
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
  setTab,
}: ExploreChartsProps) {
  const topEvents = useTopEvents();

  function handleChartTypeChange(index: number, chartType: ChartType) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === index) {
        visualize = visualize.replace({chartType});
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  }

  function handleChartVisibilityChange(index: number, visible: boolean) {
    const newVisualizes = visualizes.map((visualize, i) => {
      if (i === index) {
        visualize = visualize.replace({visible});
      }
      return visualize.serialize();
    });
    setVisualizes(newVisualizes);
  }

  useSynchronizeCharts(
    visualizes.length,
    !timeseriesResult.isPending,
    EXPLORE_CHART_GROUP
  );

  return (
    <ChartList>
      <WidgetSyncContextProvider groupName={EXPLORE_CHART_GROUP}>
        {visualizes.map((visualize, index) => {
          return (
            <Chart
              setTab={setTab}
              key={`${index}`}
              extrapolate={extrapolate}
              index={index}
              onChartTypeChange={chartType => handleChartTypeChange(index, chartType)}
              onChartVisibilityChange={visible =>
                handleChartVisibilityChange(index, visible)
              }
              query={query}
              timeseriesResult={timeseriesResult}
              visualize={visualize}
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

interface ChartProps {
  extrapolate: boolean;
  index: number;
  onChartTypeChange: (chartType: ChartType) => void;
  onChartVisibilityChange: (visible: boolean) => void;
  query: string;
  rawSpanCounts: RawCounts;
  setTab: (tab: Mode | Tab) => void;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  visualize: Visualize;
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
  visualize,
  timeseriesResult,
  samplingMode,
  topEvents,
  setTab,
}: ChartProps) {
  const [interval, setInterval, intervalOptions] = useChartInterval();

  const chartHeight = visualize.visible ? CHART_HEIGHT : 50;

  const chartRef = useRef<ReactEchartsRef>(null);
  const triggerWrapperRef = useRef<HTMLDivElement | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);

  const boxSelectOptions = useChartBoxSelect({
    chartRef,
    chartWrapperRef,
    triggerWrapperRef,
  });

  // Re-activate box selection when the series data changes
  useEffect(() => {
    boxSelectOptions.reActivateSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeseriesResult]);

  const chartType = visualize.chartType;
  const chartIcon =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  const chartInfo: ChartInfo = useMemo(() => {
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

    return {
      chartType,
      confidence: combineConfidenceForSeries(confidenceSeries),
      series,
      timeseriesResult,
      yAxis: visualize.yAxis,
      dataScanned: samplingMeta.dataScanned,
      isSampled: samplingMeta.isSampled,
      sampleCount: samplingMeta.sampleCount,
      samplingMode,
    };
  }, [chartType, timeseriesResult, visualize, samplingMode, topEvents]);

  const Title = (
    <ChartTitle>
      <Widget.WidgetTitle
        title={prettifyAggregation(visualize.yAxis) ?? visualize.yAxis}
      />
    </ChartTitle>
  );

  const Actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          triggerProps={{
            icon: <IconGraph type={chartIcon} />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
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
          triggerProps={{
            icon: <IconClock />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          menuTitle="Interval"
          options={intervalOptions}
        />
      </Tooltip>
      <ChartContextMenu
        key="context"
        visualizeYAxes={[visualize]}
        query={query}
        interval={interval}
        visualizeIndex={index}
        visible={visualize.visible}
        setVisible={onChartVisibilityChange}
      />
    </Fragment>
  );

  return (
    <ChartWrapper ref={chartWrapperRef}>
      <AttributeComparisonCTA>
        <Widget
          Title={Title}
          Actions={Actions}
          Visualization={
            visualize.visible && (
              <ChartVisualization
                chartInfo={chartInfo}
                chartRef={chartRef}
                brush={boxSelectOptions.brush}
                onBrushEnd={boxSelectOptions.onBrushEnd}
                onBrushStart={boxSelectOptions.onBrushStart}
                toolBox={boxSelectOptions.toolBox}
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
      </AttributeComparisonCTA>
      <FloatingTrigger
        chartInfo={chartInfo}
        setTab={setTab}
        boxSelectOptions={boxSelectOptions}
        triggerWrapperRef={triggerWrapperRef}
      />
    </ChartWrapper>
  );
}

const ChartWrapper = styled('div')`
  position: relative;
`;

const ChartList = styled('div')`
  position: relative;
  display: grid;
  row-gap: ${space(1)};
  margin-bottom: ${space(1)};
`;

const ChartTitle = styled('div')`
  display: flex;
`;
