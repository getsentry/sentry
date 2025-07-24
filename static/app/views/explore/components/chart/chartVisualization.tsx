import type {Ref} from 'react';
import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {isTimeSeriesOther} from 'sentry/utils/timeSeries/isTimeSeriesOther';
import {markDelayedData} from 'sentry/utils/timeSeries/markDelayedData';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {BoxSelectProps} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {prettifyAggregation} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

interface ChartVisualizationProps extends Partial<BoxSelectProps> {
  chartInfo: ChartInfo;
  chartRef?: Ref<ReactEchartsRef>;
  hidden?: boolean;
}

export function ChartVisualization({
  brush,
  onBrushEnd,
  onBrushStart,
  toolBox,
  chartInfo,
  chartRef,
  hidden = false,
}: ChartVisualizationProps) {
  const theme = useTheme();

  const plottables = useMemo(() => {
    const formattedYAxis = prettifyAggregation(chartInfo.yAxis) ?? chartInfo.yAxis;

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
          alias: formattedYAxis ?? chartInfo.yAxis,
          color: isTimeSeriesOther(s) ? theme.chartOther : undefined,
          stack: 'all',
        });
      }
      return new DataPlottableConstructor(markDelayedData(s, INGESTION_DELAY), {
        color: isTimeSeriesOther(s) ? theme.chartOther : undefined,
        stack: 'all',
      });
    });
  }, [chartInfo, theme]);

  if (hidden) {
    return null;
  }

  if (chartInfo.timeseriesResult.isPending) {
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

  if (chartInfo.timeseriesResult.error) {
    return <Widget.WidgetError error={chartInfo.timeseriesResult.error} />;
  }

  if (plottables.length === 0) {
    // This happens when the `/events-stats/` endpoint returns a blank
    // response. This is a rare error condition that happens when
    // proxying to RPC. Adding explicit handling with a "better" message
    return <Widget.WidgetError error={t('No data')} />;
  }

  return (
    <TimeSeriesWidgetVisualization
      ref={chartRef}
      brush={brush}
      onBrushEnd={onBrushEnd}
      onBrushStart={onBrushStart}
      toolBox={toolBox}
      plottables={plottables}
    />
  );
}
