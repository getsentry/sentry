import type {Theme} from '@emotion/react';
import type {LineSeriesOption} from 'echarts';

import {MarkArea} from 'sentry/components/charts/components/markArea';
import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';

const BAND_OPACITY = 0.1;

// Static thresholds are a flat y-value, percent thresholds are a line over time
type ThresholdBound = number | SeriesDataUnit[];

interface Threshold<Bound extends ThresholdBound> {
  bound: Bound;
  priority: DetectorPriorityLevel;
  type: DataConditionType;
}

// Shaded region between two thresholds, open to the chart edge when a side is missing
interface ThresholdBand<Bound extends ThresholdBound> {
  color: string;
  lower?: Bound;
  upper?: Bound;
}

interface ThresholdBandsOptions<Bound extends ThresholdBound> {
  theme: Theme;
  thresholds: Array<Threshold<Bound>>;
  resolution?: Bound;
}

export function getThresholdColor(theme: Theme, priority: DetectorPriorityLevel): string {
  return priority === DetectorPriorityLevel.HIGH
    ? theme.colors.red400
    : theme.colors.yellow400;
}

// Split the chart into adjacent non-overlapping bands, from ok to most severe
function getThresholdBands<Bound extends ThresholdBound>({
  theme,
  thresholds,
  resolution,
}: ThresholdBandsOptions<Bound>): Array<ThresholdBand<Bound>> {
  const thresholdsBySeverity = thresholds.toSorted((a, b) => a.priority - b.priority);

  const [leastSevereThreshold] = thresholdsBySeverity;

  if (!leastSevereThreshold) {
    return [];
  }

  const isAbove = leastSevereThreshold.type === DataConditionType.GREATER;

  const okBound = resolution ?? leastSevereThreshold.bound;

  const okBand: ThresholdBand<Bound> = isAbove
    ? {color: theme.colors.green400, upper: okBound}
    : {color: theme.colors.green400, lower: okBound};

  const alertBands = thresholdsBySeverity.map(
    (threshold, index): ThresholdBand<Bound> => {
      const bandColor = getThresholdColor(theme, threshold.priority);

      const nextBound = thresholdsBySeverity[index + 1]?.bound;

      return isAbove
        ? {color: bandColor, lower: threshold.bound, upper: nextBound}
        : {color: bandColor, lower: nextBound, upper: threshold.bound};
    }
  );

  return [okBand, ...alertBands];
}

export function createStaticThresholdBandSeries(
  options: ThresholdBandsOptions<number>
): LineSeriesOption[] {
  return getThresholdBands(options).map((band): LineSeriesOption => ({
    type: 'line',
    markArea: MarkArea({
      silent: true,
      itemStyle: {color: band.color, opacity: BAND_OPACITY},
      // Use infinity to clamp the shaded region to the edges of the chart
      data: [[{yAxis: band.lower ?? -Infinity}, {yAxis: band.upper ?? Infinity}]],
    }),
    data: [],
  }));
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

function createPercentBandSeries(
  band: ThresholdBand<SeriesDataUnit[]>,
  stack: string
): LineSeriesOption[] {
  const areaStyle = {color: band.color, opacity: BAND_OPACITY};

  if (band.lower && band.upper) {
    // Stack the band on its lower line so the area only fills up to the upper line
    return [
      createBandLineSeries({stack, stackStrategy: 'all', data: toLineData(band.lower)}),
      createBandLineSeries({
        stack,
        stackStrategy: 'all',
        data: subtractLines(band.upper, band.lower),
        areaStyle,
      }),
    ];
  }

  if (band.upper) {
    return [
      createBandLineSeries({
        data: toLineData(band.upper),
        areaStyle: {...areaStyle, origin: 'start'},
      }),
    ];
  }

  if (band.lower) {
    return [
      createBandLineSeries({
        data: toLineData(band.lower),
        areaStyle: {...areaStyle, origin: 'end'},
      }),
    ];
  }

  return [];
}

export function createPercentThresholdBandSeries(
  options: ThresholdBandsOptions<SeriesDataUnit[]>
): LineSeriesOption[] {
  return getThresholdBands(options).flatMap((band, index) =>
    createPercentBandSeries(band, `percent-threshold-band-${index}`)
  );
}
