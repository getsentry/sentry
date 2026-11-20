import type {Theme} from '@emotion/react';
import type {CustomSeriesOption, CustomSeriesRenderItem} from 'echarts';

import type {CartesianCoordSys} from 'sentry/components/charts/bands/bandShapes';
import {defined} from 'sentry/utils/defined';

import {
  ContinuousTimeSeries,
  isLowConfidenceDataPoint,
} from './plottables/continuousTimeSeries';
import type {Plottable} from './plottables/plottable';

export const LOW_CONFIDENCE_BACKGROUND_SERIES_ID = 'low-confidence-background';

interface TimeRange {
  end: number;
  start: number;
}

/**
 * Finds the stretches of time where any plottable has a low confidence bucket.
 * A bucket spans half an interval either side of its timestamp, the slot a bar
 * fills, so touching buckets merge into one range. Ranges are clamped to the
 * chart's bounds, since the x axis grows to fit any series that runs past them.
 */
export function getLowConfidenceRanges(
  plottables: Plottable[],
  bounds: TimeRange
): TimeRange[] {
  const slots: TimeRange[] = [];

  for (const plottable of plottables) {
    if (!(plottable instanceof ContinuousTimeSeries)) {
      continue;
    }

    const {meta, values} = plottable.timeSeries;
    for (const item of values) {
      // Incomplete buckets are drawn in the incomplete style, which hides low
      // confidence, and don't count towards `ContinuousTimeSeries.confidence`
      if (item.value === null || item.incomplete || !isLowConfidenceDataPoint(item)) {
        continue;
      }

      const start = Math.max(item.timestamp - meta.interval / 2, bounds.start);
      const end = Math.min(item.timestamp + meta.interval / 2, bounds.end);
      if (start < end) {
        slots.push({start, end});
      }
    }
  }

  const ranges: TimeRange[] = [];
  for (const slot of slots.toSorted((a, b) => a.start - b.start)) {
    const previous = ranges.at(-1);
    if (previous && slot.start <= previous.end) {
      previous.end = Math.max(previous.end, slot.end);
    } else {
      ranges.push({...slot});
    }
  }

  return ranges;
}

/**
 * Hatches the full height of the plot behind each range. A custom series,
 * rather than a `markArea`, because only custom series render a `decal`, which
 * ECharts redraws at the device pixel ratio so the stripes stay crisp.
 */
export function createLowConfidenceBackgroundSeries(
  ranges: TimeRange[],
  theme: Theme
): CustomSeriesOption {
  return {
    id: LOW_CONFIDENCE_BACKGROUND_SERIES_ID,
    name: LOW_CONFIDENCE_BACKGROUND_SERIES_ID,
    type: 'custom',
    data: ranges.map(({start, end}) => [start, end]),
    // Mapping only `x` keeps the timestamps out of the y axis extent
    encode: {x: [0, 1]},
    renderItem: lowConfidenceBackgroundRenderItem(ranges, theme),
    // Behind line, area, and bar series, which default to 2
    z: 1,
    clip: true,
    silent: true,
    animation: false,
    legendHoverLink: false,
    tooltip: {show: false},
  };
}

function lowConfidenceBackgroundRenderItem(
  ranges: TimeRange[],
  theme: Theme
): CustomSeriesRenderItem {
  return function renderLowConfidenceBackgroundItem(params, api) {
    const range = ranges[params.dataIndex];
    if (!range) {
      return null;
    }

    const [left] = api.coord([range.start, 0]);
    const [right] = api.coord([range.end, 0]);
    if (!defined(left) || !defined(right)) {
      return null;
    }

    const {y, height} = params.coordSys as CartesianCoordSys;

    return {
      type: 'rect',
      silent: true,
      shape: {x: left, y, width: right - left, height},
      style: {
        // A decal only draws over a fill. A transparent one keeps grid lines
        // visible through the gaps between stripes
        fill: 'transparent',
        decal: {
          symbol: 'rect',
          symbolSize: 1,
          dashArrayX: [1, 0],
          dashArrayY: [2, 2],
          rotation: -Math.PI / 4,
          color: theme.tokens.background.tertiary,
        },
      },
    };
  };
}
