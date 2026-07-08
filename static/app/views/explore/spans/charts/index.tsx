import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconClock, IconContract, IconExpand, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useDismissAlert} from 'sentry/utils/useDismissAlert';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useChartSelection} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {CHART_SELECTION_ALERT_KEY} from 'sentry/views/explore/components/attributeBreakdowns/constants';
import {FloatingTrigger} from 'sentry/views/explore/components/attributeBreakdowns/floatingTrigger';
import {
  ChartVisualization,
  useChartVisualizationPlottables,
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
import type {RawCounts} from 'sentry/views/explore/useRawCounts';
import {
  combineConfidenceForSeries,
  getSamplingWarningReason,
  prettifyAggregation,
} from 'sentry/views/explore/utils';
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
  timeseriesResult: SortedTimeSeries;
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
}: ChartProps) {
  const {chartSelection, setChartSelection} = useChartSelection();
  const [interval, setInterval, intervalOptions] = useChartInterval();
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

  const plottables = useChartVisualizationPlottables(chartInfo);

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
      title={prettifyAggregation(visualize.yAxis) ?? visualize.yAxis}
    />
  );

  const samplingWarningReason = getSamplingWarningReason(
    visualize.yAxis,
    chartInfo.series,
    chartInfo.dataScanned
  );
  const TitleBadges = samplingWarningReason ? (
    <SamplingWarning yAxis={visualize.yAxis} reason={samplingWarningReason} />
  ) : null;

  const Actions = visualize.visible ? (
    <Fragment>
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
      <ChartContextMenu
        key="context"
        visualizeYAxes={[visualize]}
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
