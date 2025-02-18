import {defined} from 'sentry/utils';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function determineSeriesSampleCount(
  data: TimeSeries[],
  topNMode: boolean
): number {
  if (data.length <= 0) {
    return 0;
  }

  if (topNMode) {
    // We dont want to count the other series in top N mode
    data = data.filter(s => s.field !== 'Other');
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

  const series: number[] = data[0]?.sampleCount?.map(item => item.value) ?? [];

  for (let i = 1; i < data.length; i++) {
    if (defined(data[i]?.sampleCount)) {
      for (let j = 0; j < data[i]!.sampleCount!.length; j++) {
        series[j] = merge(series[j]!, data[i]!.sampleCount![j]!.value);
      }
    }
  }

  return series.reduce((sum, count) => sum + count, 0);
}
