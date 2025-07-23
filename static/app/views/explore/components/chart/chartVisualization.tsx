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
import {
  SAMPLING_MODE,
  type SamplingMode,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {prettifyAggregation} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';
import {INGESTION_DELAY} from 'sentry/views/insights/settings';

interface ChartVisualizationProps extends Partial<BoxSelectProps> {
  chartType: ChartType;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  yAxis: string;
  chartRef?: Ref<ReactEchartsRef>;
  hidden?: boolean;
  samplingMode?: SamplingMode;
}

export function ChartVisualization({
  brush,
  onBrushEnd,
  onBrushStart,
  toolBox,
  chartType,
  timeseriesResult,
  yAxis,
  chartRef,
  hidden = false,
  samplingMode,
}: ChartVisualizationProps) {
  const theme = useTheme();

  const formattedYAxis = prettifyAggregation(yAxis) ?? yAxis;

  const plottables = useMemo(() => {
    const DataPlottableConstructor =
      chartType === ChartType.LINE ? Line : chartType === ChartType.AREA ? Area : Bars;

    const series = timeseriesResult.data[yAxis] ?? [];

    return series.map(s => {
      // We replace the series name with the formatted series name here
      // when possible as it's cleaner to read.
      //
      // We can't do this in top N mode as the series name uses the row
      // values instead of the aggregate function.
      if (s.yAxis === yAxis) {
        return new DataPlottableConstructor(markDelayedData(s, INGESTION_DELAY), {
          alias: formattedYAxis ?? yAxis,
          color: isTimeSeriesOther(s) ? theme.chartOther : undefined,
          stack: 'all',
        });
      }
      return new DataPlottableConstructor(markDelayedData(s, INGESTION_DELAY), {
        color: isTimeSeriesOther(s) ? theme.chartOther : undefined,
        stack: 'all',
      });
    });
  }, [chartType, timeseriesResult, formattedYAxis, yAxis, theme]);

  if (hidden) {
    return null;
  }

  if (timeseriesResult.isPending) {
    const loadingMessage =
      timeseriesResult.isFetching && samplingMode === SAMPLING_MODE.HIGH_ACCURACY
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

  if (timeseriesResult.error) {
    return <Widget.WidgetError error={timeseriesResult.error} />;
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
