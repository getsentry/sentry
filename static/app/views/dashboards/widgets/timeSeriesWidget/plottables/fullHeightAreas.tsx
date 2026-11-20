import type {CustomSeriesOption, CustomSeriesRenderItem} from 'echarts';

import type {CartesianCoordSys} from 'sentry/components/charts/bands/bandShapes';
import {defined} from 'sentry/utils/defined';
import {mergeTimeRanges, type TimeRange} from 'sentry/utils/timeSeries/mergeTimeRanges';

import type {
  Plottable,
  PlottableConfidence,
  PlottableTimeSeriesValueType,
} from './plottable';

type FullHeightAreasConfig = {
  /**
   * Hatch color. Areas are hatched over a transparent fill, so grid lines show
   * through the gaps between stripes
   */
  color: string;
  name: string;
  /**
   * Ranges that overlap or touch are drawn as one area
   */
  ranges: readonly TimeRange[];
  /**
   * Areas are clipped to these bounds. The x axis grows to fit any series that
   * runs past the plotted data, so pass the data's first and last timestamps
   */
  bounds?: TimeRange;
};

/**
 * Areas that span the full height of the plot over stretches of time, drawn
 * behind the data. Unlike time series plottables, it has no data of its own,
 * so it never takes up a y axis, a legend item, or a tooltip row.
 */
export class FullHeightAreas implements Plottable {
  config: Readonly<FullHeightAreasConfig>;
  ranges: readonly TimeRange[];

  confidence: PlottableConfidence = 'full';
  dataType: PlottableTimeSeriesValueType = 'number';
  dataUnit = null;
  needsColor = false;

  constructor(config: FullHeightAreasConfig) {
    this.config = config;
    this.ranges = mergeTimeRanges(config.ranges)
      .map(range => clampRange(range, config.bounds))
      .filter(range => range.start < range.end);
  }

  get name(): string {
    return this.config.name;
  }

  get label(): string {
    return this.config.name;
  }

  get isEmpty(): boolean {
    return this.ranges.length === 0;
  }

  get start(): number | null {
    return this.ranges.at(0)?.start ?? null;
  }

  get end(): number | null {
    return this.ranges.at(-1)?.end ?? null;
  }

  toSeries(): CustomSeriesOption[] {
    return [
      {
        id: this.name,
        name: this.name,
        type: 'custom',
        data: this.ranges.map(({start, end}) => [start, end]),
        // Mapping only `x` keeps the timestamps out of the y axis extent
        encode: {x: [0, 1]},
        renderItem: this.renderItem,
        // Behind line, area, and bar series, which default to 2
        z: 1,
        clip: true,
        silent: true,
        animation: false,
        legendHoverLink: false,
        tooltip: {show: false},
      },
    ];
  }

  // A custom series rather than a `markArea`, because only custom series render
  // a `decal`, which ECharts redraws at the device pixel ratio so the stripes
  // stay crisp
  private renderItem: CustomSeriesRenderItem = (params, api) => {
    const range = this.ranges[params.dataIndex];
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
        // A decal only draws over a fill
        fill: 'transparent',
        decal: {
          symbol: 'rect',
          symbolSize: 1,
          dashArrayX: [1, 0],
          dashArrayY: [2, 2],
          rotation: -Math.PI / 4,
          color: this.config.color,
        },
      },
    };
  };
}

function clampRange(range: TimeRange, bounds?: TimeRange): TimeRange {
  if (!bounds) {
    return range;
  }

  return {
    start: Math.max(range.start, bounds.start),
    end: Math.min(range.end, bounds.end),
  };
}
