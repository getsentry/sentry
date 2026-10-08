import type {Ref} from 'react';
import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {TransparentLoadingMask} from 'sentry/components/charts/transparentLoadingMask';
import type {ChartXRangeSelectionProps} from 'sentry/components/charts/useChartXRangeSelection';
import type {DroppedDataProps} from 'sentry/components/droppedData/types';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import {usePrevious} from 'sentry/utils/usePrevious';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {useIncompleteBucketTooltipDetails} from 'sentry/views/explore/components/chart/incompleteBucketTooltip';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {prettifyAggregation} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

interface ChartVisualizationProps {
  chartInfo: ChartInfo;
  chartRef?: Ref<ReactEchartsRef>;
  chartXRangeSelection?: Partial<ChartXRangeSelectionProps>;
  droppedData?: DroppedDataProps;
  /**
   * Overrides the plottables derived from `chartInfo`, e.g. when several
   * aggregates are plotted on the same chart.
   */
  plottables?: Plottable[];
}

function createChartInfoPlottables(
  chartInfo: ChartInfo,
  theme: Theme,
  {combined}: {combined: boolean}
): Plottable[] {
  const DataPlottableConstructor =
    chartInfo.chartType === ChartType.LINE
      ? Line
      : chartInfo.chartType === ChartType.AREA
        ? Area
        : Bars;

  return chartInfo.series.map(s => {
    // Grouped series are labelled by their group values only. When several
    // aggregates share a chart, prefix the aggregate so the legend and
    // tooltip stay unambiguous.
    const isGrouped = s.meta.isOther || (s.groupBy?.length ?? 0) > 0;
    const alias =
      combined && isGrouped
        ? `${prettifyAggregation(chartInfo.yAxis) ?? chartInfo.yAxis} : ${formatTimeSeriesLabel(s)}`
        : undefined;

    return new DataPlottableConstructor(markDelayedData(s, INGESTION_DELAY), {
      alias,
      color: s.meta.isOther ? theme.tokens.content.secondary : undefined,
      // Keep each aggregate in its own stack so different aggregates are
      // never summed together.
      stack: combined ? chartInfo.yAxis : 'all',
    });
  });
}

export function useChartVisualizationPlottables(chartInfo: ChartInfo) {
  const theme = useTheme();

  return useMemo(
    () => createChartInfoPlottables(chartInfo, theme, {combined: false}),
    [chartInfo, theme]
  );
}

/**
 * Builds the plottables for one or more aggregates rendered on a single chart.
 */
export function useChartInfosPlottables(chartInfos: ChartInfo[]) {
  const theme = useTheme();

  return useMemo(() => {
    const combined = chartInfos.length > 1;
    return chartInfos.flatMap(chartInfo =>
      createChartInfoPlottables(chartInfo, theme, {combined})
    );
  }, [chartInfos, theme]);
}

export function ChartVisualization({
  chartXRangeSelection,
  chartInfo,
  chartRef,
  droppedData,
  plottables: plottablesOverride,
}: ChartVisualizationProps) {
  const defaultPlottables = useChartVisualizationPlottables(chartInfo);
  const plottables = plottablesOverride ?? defaultPlottables;
  const previousPlottables = usePrevious(
    plottables,
    chartInfo.timeseriesResult.isPending
  );
  const renderTooltipSeriesDetails = useIncompleteBucketTooltipDetails(chartInfo);

  const isLoading = chartInfo.timeseriesResult.isPending;
  const activePlottables = isLoading ? previousPlottables : plottables;

  if (isLoading && !plottablesCanBeVisualized(previousPlottables)) {
    const loadingMessage =
      chartInfo.timeseriesResult.isFetching &&
      chartInfo.samplingMode === SAMPLING_MODE.HIGH_ACCURACY
        ? t(
            "Hey, we're scanning all the data we can to answer your query, so please wait a bit longer"
          )
        : undefined;
    return (
      <TimeSeriesWidgetVisualization.LoadingPlaceholder
        loadingMessage={loadingMessage}
        expectMessage
      />
    );
  }

  if (!isLoading && chartInfo.timeseriesResult.error) {
    return (
      <Container position="absolute" inset={0}>
        <Widget.WidgetError error={chartInfo.timeseriesResult.error} />
      </Container>
    );
  }

  if (!isLoading && !plottablesCanBeVisualized(plottables)) {
    // This happens when the `/events-stats/` endpoint returns a blank
    // response. This is a rare error condition that happens when
    // proxying to RPC. Adding explicit handling with a "better" message
    return <TimeSeriesWidgetVisualization.NoData />;
  }

  return (
    <StyledTransparentLoadingMask loaded={!isLoading} visible>
      <TimeSeriesWidgetVisualization
        ref={chartRef}
        plottables={activePlottables}
        chartXRangeSelection={chartXRangeSelection}
        droppedData={droppedData}
        renderTooltipSeriesDetails={renderTooltipSeriesDetails}
      />
    </StyledTransparentLoadingMask>
  );
}

const StyledTransparentLoadingMask = styled(TransparentLoadingMask)`
  position: relative;
  height: 100%;
`;
