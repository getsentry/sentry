import {defined} from 'sentry/utils';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export type SeriesSamplingInfo = {
  isSampled: boolean | null;
  sampleCount: number;
  dataScanned?: 'full' | 'partial';
};

export function determineSeriesSampleCountAndIsSampled(
  data: TimeSeries[],
  topNMode: boolean
): SeriesSamplingInfo {
  if (data.length <= 0) {
    return {sampleCount: 0, isSampled: null};
  }

  if (topNMode) {
    // We dont want to count the other series in top N mode
    data = data.filter(s => s.yAxis !== 'Other');
  }

  const merge: (a: number, b: number) => number = topNMode
    ? // In top N mode, we know all the timeseries are disjoint, so taking the sum
      // gives us an accurate sample count based on the timeseries
      (a, b) => a + b
    : // Without top N mode, we hae 2 choices, to take the sum or the max. The sum
      // will give an overestimate while the max will give an underestimate because
      // the series have the potential (not definite) to share samples.
      // We choose to use max here because showing the lower number makes it easier
      // to justify the potential low accuracy warning.
      Math.max;

  let hasSampledInterval = false;
  let hasUnsampledInterval = false;
  let dataScanned: 'full' | 'partial' | undefined;

  const series: number[] = data[0]?.values?.map(item => item.sampleCount ?? 0) ?? [];

  for (let i = 0; i < data.length; i++) {
    for (let j = 0; j < data[i]!.values.length; j++) {
      if (i > 0) {
        series[j] = merge(series[j] || 0, data[i]!.values[j]!.sampleCount || 0);
      }

      const sampleRate = data[i]!.values[j]!.sampleRate;
      if (defined(sampleRate) && sampleRate >= 1) {
        hasUnsampledInterval = true;
      } else if (defined(sampleRate) && sampleRate < 1) {
        hasSampledInterval = true;
      }
    }

    if (!dataScanned) {
      // Take one entry of dataScanned, they should all be the same
      if (data[i]?.meta.dataScanned === 'partial') {
        dataScanned = 'partial';
      } else if (data[i]?.meta.dataScanned === 'full') {
        dataScanned = 'full';
      }
    }
  }

  const isSampled = hasSampledInterval ? true : hasUnsampledInterval ? false : null;

  return {
    sampleCount: series.reduce((sum, count) => sum + count, 0),
    isSampled,
    dataScanned,
  };
}
