// eslint-disable-next-line no-restricted-imports
import color from 'color';
import type {LineSeriesOption} from 'echarts';

import {MarkArea} from 'sentry/components/charts/components/markArea';
import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import type {SeriesDataUnit} from 'sentry/types/echarts';

const BAND_OPACITY = 0.1;

// Static thresholds are a flat y-value, percent thresholds are a line over time
export type ThresholdBound = number | SeriesDataUnit[];

interface ThresholdBoundary<Bound extends ThresholdBound> {
  bound: Bound;
  color: string;
}

// Shaded region between two thresholds
export interface ThresholdBand<Bound extends ThresholdBound> {
  color: string;
  lower?: Bound;
  upper?: Bound;
}

interface GetThresholdBandsOptions<Bound extends ThresholdBound> {
  alertBoundaries: Array<ThresholdBoundary<Bound>>;
  isAbove: boolean;
  okBoundary: ThresholdBoundary<Bound>;
}

// Split the chart into adjacent non-overlapping bands
export function getThresholdBands<Bound extends ThresholdBound>({
  alertBoundaries,
  isAbove,
  okBoundary,
}: GetThresholdBandsOptions<Bound>): Array<ThresholdBand<Bound>> {
  const okBand: ThresholdBand<Bound> = isAbove
    ? {color: okBoundary.color, upper: okBoundary.bound}
    : {color: okBoundary.color, lower: okBoundary.bound};

  const alertBands = alertBoundaries.map((boundary, index): ThresholdBand<Bound> => {
    const nextBound = alertBoundaries[index + 1]?.bound;

    return isAbove
      ? {color: boundary.color, lower: boundary.bound, upper: nextBound}
      : {color: boundary.color, lower: nextBound, upper: boundary.bound};
  });

  return [okBand, ...alertBands];
}

export function createStaticThresholdBandSeries(
  band: ThresholdBand<number>
): LineSeriesOption {
  return {
    type: 'line',
    markArea: MarkArea({
      silent: true,
      itemStyle: {color: color(band.color).alpha(BAND_OPACITY).rgb().string()},
      // Use infinity to clamp the shaded region to the edges of the chart
      data: [[{yAxis: band.lower ?? -Infinity}, {yAxis: band.upper ?? Infinity}]],
    }),
    data: [],
  };
}

function createBandLineSeries(props: LineSeriesOption): LineSeriesOption {
  return createLineSeries({
    lineStyle: {opacity: 0},
    symbol: 'none',
    silent: true,
    tooltip: {show: false},
    animation: false,
    z: 1,
    ...props,
  });
}

function toLineData(line: SeriesDataUnit[]): Array<[string | number, number]> {
  return line.map(({name, value}) => [name, value]);
}

function subtractLines(
  upper: SeriesDataUnit[],
  lower: SeriesDataUnit[]
): Array<[string | number, number]> {
  return upper.map(({name, value}, index) => [name, value - (lower[index]?.value ?? 0)]);
}

function createBetweenLinesBandSeries({
  bandColor,
  lower,
  stack,
  upper,
}: {
  bandColor: string;
  lower: SeriesDataUnit[];
  stack: string;
  upper: SeriesDataUnit[];
}): LineSeriesOption[] {
  const stackOptions: LineSeriesOption = {stack, stackStrategy: 'all'};

  return [
    createBandLineSeries({...stackOptions, data: toLineData(lower)}),
    createBandLineSeries({
      ...stackOptions,
      data: subtractLines(upper, lower),
      areaStyle: {color: bandColor, opacity: BAND_OPACITY},
    }),
  ];
}

export function createPercentThresholdBandSeries(
  band: ThresholdBand<SeriesDataUnit[]>,
  stack: string
): LineSeriesOption[] {
  if (band.lower && band.upper) {
    return createBetweenLinesBandSeries({
      bandColor: band.color,
      lower: band.lower,
      stack,
      upper: band.upper,
    });
  }

  if (band.upper) {
    return [
      createBandLineSeries({
        data: toLineData(band.upper),
        areaStyle: {color: band.color, opacity: BAND_OPACITY, origin: 'start'},
      }),
    ];
  }

  if (band.lower) {
    return [
      createBandLineSeries({
        data: toLineData(band.lower),
        areaStyle: {color: band.color, opacity: BAND_OPACITY, origin: 'end'},
      }),
    ];
  }

  return [];
}
