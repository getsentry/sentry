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
   * Color of the stripes
   */
  color: string;
  /**
   * Type of the Y axis to draw against. The areas don't read Y values, but the
   * chart puts every plottable on an axis by its type, so this should match an
   * axis the chart already has
   */
  dataType: PlottableTimeSeriesValueType;
  /**
   * Color of the translucent wash under the stripes. Use the chart's background
   * color, so the data fades toward it without changing its hue
   */
  fadeColor: string;
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
 * Hatched areas that span the full height of the plot over stretches of time,
 * drawn over the data. A translucent wash fades the data under them, so series
 * colors don't clash with the stripes, and the stripes run unbroken across data
 * and empty space alike. Canvas patterns are anchored to the chart's origin, so
 * the stripes line up across areas, bars, and gaps without any offsets.
 *
 * Unlike time series plottables, it has no data of its own, so it never takes
 * up a Y axis, a legend item, or a tooltip row.
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
        // Over line and area series, which default to 3, and under mark lines and points, which default to 5
        z: 4,
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
    const shape = {x: left, y, width: right - left, height};

    // A decal copies its element's opacity, so the wash and the stripes need
    // separate elements to have different opacities
    return {
      type: 'group',
      children: [
        {
          type: 'rect',
          silent: true,
          shape,
          style: {fill: this.config.fadeColor, opacity: WASH_OPACITY},
        },
        {
          type: 'rect',
          silent: true,
          shape,
          style: {
            // A decal only draws over a fill
            fill: 'transparent',
            opacity: STRIPE_OPACITY,
            decal: {
              symbol: 'rect',
              symbolSize: 1,
              dashArrayX: [1, 0],
              dashArrayY: [2, 2],
              rotation: -Math.PI / 4,
              color: this.config.color,
            },
          },
        },
      ],
    };
  };
}

const WASH_OPACITY = 0.5;
const STRIPE_OPACITY = 0.6;
