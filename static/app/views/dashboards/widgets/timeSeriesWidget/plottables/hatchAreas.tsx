import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
} from 'echarts';

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
   * Color of the stripes drawn behind the data, which mark empty space
   */
  color: string;
  /**
   * Type of the Y axis to draw against. The areas don't read Y values, but the
   * chart puts every plottable on an axis by its type, so this should match an
   * axis the chart already has
   */
  dataType: PlottableTimeSeriesValueType;
  /**
   * Color of the translucent wash and stripes drawn over the data. The stripes
   * sit in the gaps between the stripes behind it. Use a background color, so
   * the data fades without changing its hue
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
 * Hatched areas that span the full height of the plot over stretches of time.
 * One set of stripes goes behind the data and a second set goes over it, in the
 * gaps of the first, so the hatch runs unbroken across empty space and data
 * alike. Canvas patterns are anchored to the chart's origin, so the stripes line
 * up across areas, bars, and gaps without any offsets. Unlike time series
 * plottables, it has no data of its own, so it never takes up a Y axis, a legend
 * item, or a tooltip row.
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

    const series = {
      name: this.name,
      type: 'custom',
      data: ranges.map(({start, end}) => [start, end]),
      // Mapping only `x` keeps the timestamps out of the Y axis extent
      encode: {x: [0, 1]},
      clip: true,
      silent: true,
      animation: false,
      legendHoverLink: false,
      tooltip: {show: false},
    } satisfies CustomSeriesOption;

    return [
      {
        ...series,
        id: `${this.name}-background`,
        renderItem: this.renderBackground,
        // Under bar series, which default to 2, and line and area series, which default to 3
        z: 1,
      },
      {
        ...series,
        id: this.name,
        renderItem: this.renderForeground,
        // Over line and area series, which default to 3, and under mark lines and points, which default to 5
        z: 4,
      },
    ];
  }

  private renderBackground: CustomSeriesRenderItem = (params, api) =>
    this.renderStripes(params, api, {
      color: this.config.color,
      dashArrayY: [2, 2],
      opacity: BACKGROUND_STRIPE_OPACITY,
    });

  // A translucent wash dims the data so its colors don't clash with the
  // hatch, and stripes over it fade the data further in the background's gaps
  private renderForeground: CustomSeriesRenderItem = (params, api) => {
    const stripes = this.renderStripes(params, api, {
      color: this.config.fadeColor,
      // Starting with an empty dash shifts these stripes into the background's gaps
      dashArrayY: [0, 2, 2, 0],
      opacity: FOREGROUND_STRIPE_OPACITY,
    });
    if (!stripes) {
      return null;
    }

    return {
      type: 'group',
      children: [
        {
          type: 'rect',
          silent: true,
          shape: stripes.shape,
          style: {fill: this.config.fadeColor, opacity: WASH_OPACITY},
        },
        stripes,
      ],
    };
  };

  // A custom series rather than a `markArea`, because only custom series render
  // a `decal`, which ECharts redraws at the device pixel ratio so the stripes
  // stay crisp
  private renderStripes(
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI,
    stripes: {color: string; dashArrayY: number[]; opacity: number}
  ) {
    const [left] = api.coord([api.value(0), 0]);
    const [right] = api.coord([api.value(1), 0]);
    if (!defined(left) || !defined(right)) {
      return null;
    }

    const {y, height} = params.coordSys as CartesianCoordSys;

    return {
      type: 'rect' as const,
      silent: true,
      shape: {x: left, y, width: right - left, height},
      style: {
        // A decal only draws over a fill
        fill: 'transparent',
        opacity: stripes.opacity,
        decal: {
          symbol: 'rect',
          symbolSize: 1,
          dashArrayX: [1, 0],
          dashArrayY: stripes.dashArrayY,
          rotation: -Math.PI / 4,
          color: stripes.color,
        },
      },
    };
  }
}

const BACKGROUND_STRIPE_OPACITY = 0.6;
const WASH_OPACITY = 0.5;
const FOREGROUND_STRIPE_OPACITY = 0.4;
