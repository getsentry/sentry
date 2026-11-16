import type {
  GridComponentOption,
  SeriesOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';

import type {EChartClickHandler} from 'sentry/types/echarts';

import {DROPPED_DATA_SERIES_ID, type useDroppedDataBand} from './useDroppedDataBand';

type DroppedDataBand = ReturnType<typeof useDroppedDataBand>;

interface DroppedDataBandChartOptions {
  grid: GridComponentOption & {bottom: number};
  yAxes: YAXisComponentOption[];
  onClick?: EChartClickHandler;
  series?: SeriesOption[];
  xAxis?: XAXisComponentOption;
}

/**
 * Adds the dropped-data band to a chart's options. The band takes the next
 * y-axis, and its height is added to the grid bottom and x-axis offset so it
 * can stack under other bands. Clicks on the band call `onBandClick` instead
 * of the chart's own handler.
 */
export function mergeDroppedDataBand(
  options: DroppedDataBandChartOptions,
  {droppedDataSeries, droppedDataYAxis, droppedDataBandHeight}: DroppedDataBand,
  onBandClick?: () => void
): DroppedDataBandChartOptions {
  if (!droppedDataSeries || !droppedDataYAxis) {
    return options;
  }

  const {grid, onClick, series, xAxis, yAxes} = options;

  return {
    grid: {...grid, bottom: grid.bottom + droppedDataBandHeight},
    xAxis: {
      ...xAxis,
      offset: (xAxis?.offset ?? 0) + droppedDataBandHeight,
      axisLine: {...xAxis?.axisLine, onZero: false},
    },
    yAxes: [...yAxes, droppedDataYAxis],
    series: [...(series ?? []), {...droppedDataSeries, yAxisIndex: yAxes.length}],
    onClick: (event, instance) => {
      if (event.seriesId === DROPPED_DATA_SERIES_ID) {
        onBandClick?.();
        return;
      }
      onClick?.(event, instance);
    },
  };
}
