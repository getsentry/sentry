/**
 * Given a timeseries and a list of values, marks each point whose value is in the list as low confidence, and every other point as high confidence
 */

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function markLowConfidence(
  timeSeries: TimeSeries,
  lowConfidenceValues: number[]
): TimeSeries {
  return {
    ...timeSeries,
    values: timeSeries.values.map(datum => ({
      ...datum,
      confidence:
        datum.value !== null && lowConfidenceValues.includes(datum.value)
          ? 'low'
          : 'high',
    })),
  };
}
