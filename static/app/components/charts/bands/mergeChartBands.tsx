import type {
  CustomSeriesOption,
  GridComponentOption,
  SeriesOption,
  XAXisComponentOption,
  YAXisComponentOption,
} from 'echarts';

import type {EChartClickHandler} from 'sentry/types/echarts';
import {defined} from 'sentry/utils/defined';

import {BAND_Y_AXIS, BAND_Z, type BandBucket} from './bandShapes';

/**
 * A strip of per-bucket markers drawn under a chart's plot.
 */
export interface ChartBand {
  buckets: BandBucket[];
  height: number;
  id: string;
  series: (offset: number) => CustomSeriesOption;
  onClick?: () => void;
  tooltipSection?: (start: number) => React.ReactElement | null;
}

interface ChartBandsOptions {
  grid: GridComponentOption & {bottom: number};
  yAxes: YAXisComponentOption[];
  onClick?: EChartClickHandler;
  series?: SeriesOption[];
  xAxis?: XAXisComponentOption;
}

interface MergeChartBandsParams {
  offset?: number;
}

/**
 * Stacks bands under a chart's plot in the order given. Each band takes the
 * next y-axis and sits below the bands before it. Their total height is added
 * to the grid bottom and x-axis offset to keep the x-axis under the stack.
 */
export function mergeChartBands(
  options: ChartBandsOptions,
  bands: Array<ChartBand | null>,
  {offset = 0}: MergeChartBandsParams = {}
): ChartBandsOptions {
  const visibleBands = bands.filter(defined);
  if (visibleBands.length === 0) {
    return options;
  }

  const {grid, onClick, series, xAxis, yAxes} = options;

  let bandOffset = offset;
  const bandSeries = visibleBands.map((band, index) => {
    const bandSeriesOption = {
      ...band.series(bandOffset),
      id: band.id,
      yAxisIndex: yAxes.length + index,
      z: BAND_Z,
    };
    bandOffset += band.height;
    return bandSeriesOption;
  });

  const stackHeight = bandOffset - offset;

  return {
    grid: {...grid, bottom: grid.bottom + stackHeight},
    xAxis: {
      ...xAxis,
      offset: (xAxis?.offset ?? 0) + stackHeight,
      axisLine: {...xAxis?.axisLine, onZero: false},
    },
    yAxes: [...yAxes, ...visibleBands.map(() => BAND_Y_AXIS)],
    series: [...(series ?? []), ...bandSeries],
    onClick: (event, instance) => {
      const clickedBand = visibleBands.find(band => band.id === event.seriesId);
      if (clickedBand) {
        clickedBand.onClick?.();
        return;
      }
      onClick?.(event, instance);
    },
  };
}
