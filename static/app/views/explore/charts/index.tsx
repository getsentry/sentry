import type {ReactNode} from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {parseFunction, prettifyParsedFunction} from 'sentry/utils/discover/fields';
import type {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {isTimeSeriesOther} from 'sentry/utils/timeSeries/isTimeSeriesOther';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import usePrevious from 'sentry/utils/usePrevious';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ConfidenceFooter} from 'sentry/views/explore/charts/confidenceFooter';
import ChartContextMenu from 'sentry/views/explore/components/chartContextMenu';
import {FloatingTrigger} from 'sentry/views/explore/components/suspectTags/floatingTrigger';
import type {
  BaseVisualize,
  Visualize,
} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useChartBoxSelect} from 'sentry/views/explore/hooks/useChartBoxSelect';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  SAMPLING_MODE,
  type SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {CHART_HEIGHT, INGESTION_DELAY} from 'sentry/views/explore/settings';
import {combineConfidenceForSeries} from 'sentry/views/explore/utils';
import {
  ChartType,
  useSynchronizeCharts,
} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface ExploreChartsProps {
  canUsePreviousResults: boolean;
  confidences: Confidence[];
  query: string;
  setVisualizes: (visualizes: BaseVisualize[]) => void;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  visualizes: Visualize[];
  hideContextMenu?: boolean;
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

type NamedTimeSeries = TimeSeries & {
  seriesName?: string;
};

interface ChartInfo {
  chartIcon: ReactNode;
  chartType: ChartType;
  data: NamedTimeSeries[];
  error: QueryError | null;
  isSampled: boolean | null;
  loading: boolean;
  sampleCount: number;
  yAxes: readonly string[];
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  formattedYAxes?: Array<string | undefined>;
  label?: string;
  stack?: string;
}

export function ExploreCharts({
  canUsePreviousResults,
  confidences,
  query,
  timeseriesResult,
  visualizes,
  setVisualizes,
  hideContextMenu,
  samplingMode,
}: ExploreChartsProps) {
  const [interval, setInterval, intervalOptions] = useChartInterval();
  const topEvents = useTopEvents();
  const isTopN = defined(topEvents) && topEvents > 0;
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  const previousTimeseriesResult = usePrevious(timeseriesResult);

  const getSeries = useCallback(
    (dedupedYAxes: string[], formattedYAxes: Array<string | undefined>) => {
      const shouldUsePreviousResults =
        timeseriesResult.isPending &&
        canUsePreviousResults &&
        dedupedYAxes.every(yAxis => previousTimeseriesResult.data.hasOwnProperty(yAxis));

      const data: NamedTimeSeries[] = dedupedYAxes.flatMap((yAxis, i) => {
        const series = shouldUsePreviousResults
          ? previousTimeseriesResult.data[yAxis]
          : timeseriesResult.data[yAxis];

        return (series ?? []).map(s => {
          // We replace the series name with the formatted series name here
          // when possible as it's cleaner to read.
          //
          // We can't do this in top N mode as the series name uses the row
          // values instead of the aggregate function.
          if (s.yAxis === yAxis) {
            return {
              ...s,
              seriesName: formattedYAxes[i] ?? yAxis,
            };
          }
          return s;
        });
      });

      return {
        data,
        error: shouldUsePreviousResults
          ? previousTimeseriesResult.error
          : timeseriesResult.error,
        loading: shouldUsePreviousResults
          ? previousTimeseriesResult.isPending
          : timeseriesResult.isPending,
      };
    },
    [canUsePreviousResults, timeseriesResult, previousTimeseriesResult]
  );

  const getChartInfo = useCallback(
    (yAxis: string) => {
      const dedupedYAxes = [yAxis];

      const formattedYAxes = dedupedYAxes.map(yaxis => {
        const func = parseFunction(yaxis);
        return func ? prettifyParsedFunction(func) : undefined;
      });

      const {data, error, loading} = getSeries(dedupedYAxes, formattedYAxes);

      const {sampleCount, isSampled, dataScanned} =
        determineSeriesSampleCountAndIsSampled(data, isTopN);

      return {
        dedupedYAxes,
        formattedYAxes,
        data,
        error,
        loading,
        sampleCount,
        isSampled,
        dataScanned,
      };
    },
    [getSeries, isTopN]
  );

  const chartInfos = useMemo(() => {
    const shouldRenderLabel = visualizes.length > 1;
    return visualizes.map((visualize, index) => {
      const chartIcon =
        visualize.chartType === ChartType.LINE
          ? 'line'
          : visualize.chartType === ChartType.AREA
            ? 'area'
            : 'bar';

      const {
        dedupedYAxes,
        formattedYAxes,
        data,
        error,
        loading,
        sampleCount,
        isSampled,
        dataScanned,
      } = getChartInfo(visualize.yAxis);

      let overrideSampleCount = undefined;
      let overrideIsSampled = undefined;
      let overrideDataScanned = undefined;
      let overrideConfidence = undefined;

      // This implies that the sampling meta data is not available.
      // When this happens, we override it with the sampling meta
      // data from the DEFAULT_VISUALIZATION.
      if (sampleCount === 0 && !defined(isSampled)) {
        const chartInfo = getChartInfo(DEFAULT_VISUALIZATION);
        overrideSampleCount = chartInfo.sampleCount;
        overrideIsSampled = chartInfo.isSampled;
        overrideDataScanned = chartInfo.dataScanned;

        const series = dedupedYAxes
          .flatMap(yAxis => timeseriesResult.data[yAxis])
          .filter(defined);
        overrideConfidence = combineConfidenceForSeries(series);
      }

      const chartInfo: ChartInfo = {
        chartIcon: <IconGraph type={chartIcon} />,
        chartType: visualize.chartType,
        stack: visualize.stack,
        label: shouldRenderLabel ? visualize.label : undefined,
        yAxes: [visualize.yAxis],
        formattedYAxes,
        data,
        error,
        loading,
        confidence: overrideConfidence ?? confidences[index],
        sampleCount: overrideSampleCount ?? sampleCount,
        isSampled: overrideIsSampled ?? isSampled,
        dataScanned: overrideDataScanned ?? dataScanned,
      };

      return chartInfo;
    });
  }, [confidences, getChartInfo, visualizes, timeseriesResult]);

  const handleChartTypeChange = useCallback(
    (chartType: ChartType, index: number) => {
      const newVisualizes = visualizes.map((visualize, i) => {
        if (i === index) {
          visualize = visualize.replace({chartType});
        }
        return visualize.toJSON();
      });
      setVisualizes(newVisualizes);
    },
    [visualizes, setVisualizes]
  );

  useSynchronizeCharts(
    visualizes.length,
    !timeseriesResult.isPending,
    EXPLORE_CHART_GROUP
  );

  return (
    <ChartList ref={chartWrapperRef}>
      <WidgetSyncContextProvider>
        {chartInfos.map((chartInfo, index) => {
          return (
            <Chart
              key={index}
              chartInfo={chartInfo}
              handleChartTypeChange={handleChartTypeChange}
              index={index}
              interval={interval}
              intervalOptions={intervalOptions}
              query={query}
              setInterval={setInterval}
              timeseriesResult={timeseriesResult}
              hideContextMenu={hideContextMenu}
              samplingMode={samplingMode}
              topEvents={topEvents}
              chartWrapperRef={chartWrapperRef}
            />
          );
        })}
      </WidgetSyncContextProvider>
    </ChartList>
  );
}

interface ChartProps {
  chartInfo: ChartInfo;
  chartWrapperRef: React.RefObject<HTMLDivElement | null>;
  handleChartTypeChange: (chartType: ChartType, index: number) => void;
  index: number;
  interval: string;
  intervalOptions: Array<{label: string; value: string}>;
  query: string;
  setInterval: (interval: string) => void;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  hideContextMenu?: boolean;
  samplingMode?: SamplingMode;
  topEvents?: number;
}

function Chart({
  chartInfo,
  handleChartTypeChange,
  index,
  interval,
  intervalOptions,
  query,
  setInterval,
  timeseriesResult,
  hideContextMenu,
  samplingMode,
  topEvents,
  chartWrapperRef,
}: ChartProps) {
  const theme = useTheme();
  const [visible, setVisible] = useState(true);

  const chartHeight = visible ? CHART_HEIGHT : 50;

  const chartRef = useRef<ReactEchartsRef>(null);
  const triggerWrapperRef = useRef<HTMLDivElement | null>(null);

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

  const Title = (
    <ChartTitle>
      {defined(chartInfo.label) ? <ChartLabel>{chartInfo.label}</ChartLabel> : null}
      <Widget.WidgetTitle title={chartInfo.formattedYAxes?.filter(Boolean).join(', ')} />
    </ChartTitle>
  );

  const actions = useMemo(() => {
    return [
      <Tooltip
        key="visualization"
        title={t('Type of chart displayed in this visualization (ex. line)')}
      >
        <CompactSelect
          triggerProps={{
            icon: chartInfo.chartIcon,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          value={chartInfo.chartType}
          menuTitle="Type"
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={option => handleChartTypeChange(option.value, index)}
        />
      </Tooltip>,
      <Tooltip
        key="interval"
        title={t('Time interval displayed in this visualization (ex. 5m)')}
      >
        <CompactSelect
          value={interval}
          onChange={({value}) => setInterval(value)}
          triggerProps={{
            icon: <IconClock />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          menuTitle="Interval"
          options={intervalOptions}
        />
      </Tooltip>,
      ...(hideContextMenu
        ? []
        : [
            <ChartContextMenu
              key="context"
              visualizeYAxes={chartInfo.yAxes}
              query={query}
              interval={interval}
              visualizeIndex={index}
              visible={visible}
              setVisible={setVisible}
            />,
          ]),
    ];
  }, [
    chartInfo,
    handleChartTypeChange,
    interval,
    setInterval,
    intervalOptions,
    query,
    index,
    hideContextMenu,
    visible,
    setVisible,
  ]);

  if (!visible) {
    return (
      <Widget
        key={index}
        height={chartHeight}
        Title={Title}
        Actions={actions}
        revealActions="always"
        Visualization={null}
        Footer={null}
      />
    );
  }

  if (chartInfo.loading) {
    const loadingMessage =
      timeseriesResult.isFetching && samplingMode === SAMPLING_MODE.HIGH_ACCURACY
        ? t(
            "Hey, we're scanning all the data we can to answer your query, so please wait a bit longer"
          )
        : undefined;
    return (
      <Widget
        key={index}
        height={chartHeight}
        Title={Title}
        Visualization={
          <TimeSeriesWidgetVisualization.LoadingPlaceholder
            loadingMessage={loadingMessage}
            expectMessage
          />
        }
        revealActions="always"
      />
    );
  }

  if (chartInfo.error) {
    return (
      <Widget
        key={index}
        height={chartHeight}
        Title={Title}
        Visualization={<Widget.WidgetError error={chartInfo.error} />}
        revealActions="always"
      />
    );
  }

  if (chartInfo.data.length === 0) {
    // This happens when the `/events-stats/` endpoint returns a blank
    // response. This is a rare error condition that happens when
    // proxying to RPC. Adding explicit handling with a "better" message
    return (
      <Widget
        key={index}
        height={chartHeight}
        Title={Title}
        Visualization={<Widget.WidgetError error={t('No data')} />}
        revealActions="always"
      />
    );
  }

  const DataPlottableConstructor =
    chartInfo.chartType === ChartType.LINE
      ? Line
      : chartInfo.chartType === ChartType.AREA
        ? Area
        : Bars;

  return (
    <ChartWrapper>
      <Widget
        key={index}
        height={chartHeight}
        Title={Title}
        Actions={actions}
        revealActions="always"
        Visualization={
          <TimeSeriesWidgetVisualization
            ref={chartRef}
            brush={boxSelectOptions.brush}
            onBrushEnd={boxSelectOptions.onBrushEnd}
            toolBox={boxSelectOptions.toolBox}
            plottables={chartInfo.data.map(timeSeries => {
              return new DataPlottableConstructor(
                markDelayedData(timeSeries, INGESTION_DELAY),
                {
                  alias: timeSeries.seriesName,
                  color: isTimeSeriesOther(timeSeries) ? theme.chartOther : undefined,
                  stack: chartInfo.stack,
                }
              );
            })}
          />
        }
        Footer={
          <ConfidenceFooter
            sampleCount={chartInfo.sampleCount}
            isSampled={chartInfo.isSampled}
            confidence={chartInfo.confidence}
            topEvents={topEvents ? Math.min(topEvents, chartInfo.data.length) : undefined}
            dataScanned={chartInfo.dataScanned}
          />
        }
      />
      <FloatingTrigger
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

const ChartLabel = styled('div')`
  background-color: ${p => p.theme.purple100};
  border-radius: ${p => p.theme.borderRadius};
  text-align: center;
  min-width: 24px;
  color: ${p => p.theme.purple400};
  white-space: nowrap;
  font-weight: ${p => p.theme.fontWeightBold};
  align-content: center;
  margin-right: ${space(1)};
`;

const ChartTitle = styled('div')`
  display: flex;
`;
