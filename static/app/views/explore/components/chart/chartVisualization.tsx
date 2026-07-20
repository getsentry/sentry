import type {Ref} from 'react';
import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {TransparentLoadingMask} from 'sentry/components/charts/transparentLoadingMask';
import type {ChartXRangeSelectionProps} from 'sentry/components/charts/useChartXRangeSelection';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import {usePrevious} from 'sentry/utils/usePrevious';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

interface ChartVisualizationProps {
  chartInfo: ChartInfo;
  chartRef?: Ref<ReactEchartsRef>;
  chartXRangeSelection?: Partial<ChartXRangeSelectionProps>;
}

export function useChartVisualizationPlottables(chartInfo: ChartInfo) {
  const theme = useTheme();

  return useMemo(() => {
    const DataPlottableConstructor =
      chartInfo.chartType === ChartType.LINE
        ? Line
        : chartInfo.chartType === ChartType.AREA
          ? Area
          : Bars;

    return chartInfo.series.map(s => {
      // We replace the series name with the formatted series name here
      // when possible as it's cleaner to read.
      //
      // We can't do this in top N mode as the series name uses the row
      // values instead of the aggregate function.
      if (s.yAxis === chartInfo.yAxis) {
        return new DataPlottableConstructor(markDelayedData(s, INGESTION_DELAY), {
          color: s.meta.isOther ? theme.tokens.content.secondary : undefined,
          stack: 'all',
        });
      }
      return new DataPlottableConstructor(markDelayedData(s, INGESTION_DELAY), {
        color: s.meta.isOther ? theme.tokens.content.secondary : undefined,
        stack: 'all',
      });
    });
  }, [chartInfo, theme]);
}

export function ChartVisualization({
  chartXRangeSelection,
  chartInfo,
  chartRef,
}: ChartVisualizationProps) {
  const plottables = useChartVisualizationPlottables(chartInfo);
  const previousPlottables = usePrevious(
    plottables,
    chartInfo.timeseriesResult.isPending
  );

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
    return (
      <Container position="absolute" inset={0}>
        <TimeSeriesWidgetVisualization.NoData />
      </Container>
    );
  }

  return (
    <StyledTransparentLoadingMask loaded={!isLoading} visible>
      <TimeSeriesWidgetVisualization
        ref={chartRef}
        plottables={activePlottables}
        chartXRangeSelection={chartXRangeSelection}
      />
    </StyledTransparentLoadingMask>
  );
}

const StyledTransparentLoadingMask = styled(TransparentLoadingMask)`
  position: relative;
  height: 100%;
`;
