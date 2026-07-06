import type {XAXisComponentOption, YAXisComponentOption} from 'echarts';

import {formatYAxisValue} from 'sentry/views/dashboards/widgets/heatMapWidget/formatters/formatYAxisValue';
import {formatXAxisTimestamp} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatXAxisTimestamp';

/**
 * Pieces of the heat map cartesian axes, shared between the in-app
 * visualization and the Chartcuterie (server-side render) config.
 *
 * ECharts requires category axes for heat map series, but a category axis can
 * only put ticks on the bucket boundaries, which rarely fall on readable
 * values. So on each dimension we pair the hidden category axis below (which
 * positions the cells) with an overlay axis (`heatMapValueAxis` on Y,
 * `heatMapTimeAxis` on X) that ECharts can put clean ticks on.
 */

/**
 * Positions the heat map cells. `show: false` hides the axis while keeping it
 * in the coordinate system to place the cells.
 *
 * `axisLabel: {show: false}` looks redundant with `show: false`, but it isn't:
 * the app also loads the full `echarts` bundle (via `useChartXRangeSelection`),
 * which registers the legacy `containLabel` layout. That layout reserves grid
 * space for an axis's labels based on `axisLabel.show` alone — it ignores the
 * axis-level `show` — so without this the hidden category axis pads the chart
 * with room for its (never-rendered) bucket-boundary labels.
 */
export const HIDDEN_CATEGORY_AXIS = {
  type: 'category',
  show: false,
  axisLabel: {show: false},
  // `BaseChart`'s `XAxis` wrapper turns the axis pointer on by default. Left
  // enabled it highlights the whole hovered column, which (combined with the
  // series' emphasis border) outlines every cell in it — so disable it.
  axisPointer: {show: false},
} as const;

export function heatMapValueAxis({
  min,
  max,
  valueType,
  valueUnit,
}: {
  max: number;
  min: number;
  valueType: string;
  valueUnit?: string;
}): YAXisComponentOption {
  return {
    type: 'value',
    position: 'left',
    min,
    max,
    animation: false,
    axisLabel: {
      hideOverlap: true,
      // `min`/`max` are bucket boundaries and rarely round, so hide them.
      showMinLabel: false,
      showMaxLabel: false,
      formatter: (value: number) => formatYAxisValue(value, valueType, valueUnit),
    },
    axisLine: {show: false},
    splitArea: {show: false},
    splitLine: {show: false},
  };
}

export function heatMapTimeAxis({
  min,
  max,
  timezone,
}: {
  max: number;
  min: number;
  timezone: string;
}): XAXisComponentOption {
  return {
    type: 'time',
    position: 'bottom',
    min,
    max,
    animation: false,
    axisLabel: {
      hideOverlap: true,
      formatter: (value: number) => formatXAxisTimestamp(value, timezone),
    },
    axisPointer: {show: false},
    splitArea: {show: false},
    splitLine: {show: false},
  };
}
