import type {CustomSeriesOption, CustomSeriesRenderItem} from 'echarts';

import type {CartesianCoordSys} from 'sentry/components/charts/bands/bandShapes';
import {defined} from 'sentry/utils/defined';
import type {TimeRange} from 'sentry/utils/timeSeries/mergeTimeRanges';

import type {
  Plottable,
  PlottableConfidence,
  PlottableTimeSeriesValueType,
} from './plottable';

type HatchAreasConfig = {
  /**
   * Hatch color. Areas are hatched over a transparent fill, so grid lines show
   * through the gaps between stripes
   */
  color: string;
  /**
   * Type of the Y axis to draw against. The areas don't read Y values, but the
   * chart puts every plottable on an axis by its type, so this should match an
   * axis the chart already has
   */
  dataType: PlottableTimeSeriesValueType;
  /**
   * Identifies the plottable. It becomes the ECharts series ID and name, so it
   * must be unique among the chart's plottables
   */
  name: string;
};

type HatchAreasPlottingOptions = {
  /**
   * Areas are clipped to these bounds. The X axis grows to fit any series that
   * runs past the plotted data, so pass the data's first and last timestamps
   */
  bounds?: TimeRange;
};

/**
 * Hatched areas that span the full height of the plot over stretches of time, drawn
 * behind the data. Unlike time series plottables, it has no data of its own,
 * so it never takes up a Y axis, a legend item, or a tooltip row.
 */
export class HatchAreas implements Plottable {
  ranges: readonly TimeRange[];
  config: Readonly<HatchAreasConfig>;

  // Required by `Plottable`. The areas have no data, so none of it is extrapolated
  confidence: PlottableConfidence = 'full';
  dataUnit = null;
  needsColor = false;

  /**
   * @param ranges Sorted ranges that don't overlap, such as the output of `mergeTimeRanges`
   */
  constructor(ranges: readonly TimeRange[], config: HatchAreasConfig) {
    this.ranges = ranges;
    this.config = config;
  }

  get name(): string {
    return this.config.name;
  }

  get dataType(): PlottableTimeSeriesValueType {
    return this.config.dataType;
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

  toSeries({bounds}: HatchAreasPlottingOptions = {}): CustomSeriesOption[] {
    const ranges = bounds
      ? this.ranges
          .map(({start, end}) => ({
            start: Math.max(start, bounds.start),
            end: Math.min(end, bounds.end),
          }))
          .filter(({start, end}) => start < end)
      : this.ranges;

    return [
      {
        id: this.name,
        name: this.name,
        type: 'custom',
        data: ranges.map(({start, end}) => [start, end]),
        // Mapping only `x` keeps the timestamps out of the Y axis extent
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
    const [left] = api.coord([api.value(0), 0]);
    const [right] = api.coord([api.value(1), 0]);
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
