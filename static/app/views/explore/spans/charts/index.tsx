import {Fragment, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useChartSelection} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {CHART_SELECTION_ALERT_KEY} from 'sentry/views/explore/components/attributeBreakdowns/constants';
import {FloatingTrigger} from 'sentry/views/explore/components/attributeBreakdowns/floatingTrigger';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import ChartContextMenu from 'sentry/views/explore/components/chartContextMenu';
import type {BaseVisualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
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
  const organization = useOrganization();
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

  const Title = (
    <Flex>
      <Widget.WidgetTitle
        title={prettifyAggregation(visualize.yAxis) ?? visualize.yAxis}
      />
    </Flex>
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

  const initialChartSelection =
    chartSelection && chartSelection.chartIndex === index
      ? chartSelection.selection
      : undefined;

  return (
    <ChartWrapper ref={chartWrapperRef}>
      <Widget
        Title={Title}
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
                  if (!params.selectionState) return;

                  params.setSelectionState({
                    ...params.selectionState,
                    isActionMenuVisible: true,
                  });
                },
                onOutsideSelectionClick: params => {
                  if (!params.selectionState?.isActionMenuVisible) return;

                  params.setSelectionState({
                    ...params.selectionState,
                    isActionMenuVisible: false,
                  });
                },
                onClearSelection: () => {
                  setChartSelection(null);
                },
                disabled: !organization.features.includes(
                  'performance-spans-suspect-attributes'
                ),
                actionMenuRenderer: params => {
                  return (
                    <FloatingTrigger chartIndex={index} params={params} setTab={setTab} />
                  );
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

const ChartWrapper = styled('div')`
  position: relative;
`;

const ChartList = styled('div')`
  position: relative;
  display: grid;
  row-gap: ${space(1)};
  margin-bottom: ${space(1)};
`;
