import type {Series} from 'sentry/types/echarts';

import type {RollingStrategy} from './getAggregateRollingStrategy';

/**
 * Applies a rolling window computation to a chart series.
 *
 * For each data point at index `i`, looks back `windowSize` points and computes
 * either the sum or average of available values. Points at the start with fewer
 * than `windowSize` preceding points use all available points (partial windows).
 *
 * Returns the series unchanged if windowSize <= 1.
 */
export function applyRollingWindow(
  series: Series,
  windowSize: number,
  strategy: RollingStrategy
): Series {
  if (windowSize <= 1) {
    return series;
  }

  const {data} = series;
  if (data.length === 0) {
    return series;
  }

  const rolledData = data.map((point, i) => {
    const windowStart = Math.max(0, i - windowSize + 1);
    const windowLength = i - windowStart + 1;

    let sum = 0;
    for (let j = windowStart; j <= i; j++) {
      sum += data[j]!.value;
    }

    return {
      ...point,
      value: strategy === 'sum' ? sum : sum / windowLength,
    };
  });

  return {
    ...series,
    data: rolledData,
  };
}
