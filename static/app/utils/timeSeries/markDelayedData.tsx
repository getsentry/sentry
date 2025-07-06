/**
 * Given a timeseries and a delay in seconds, goes through the timeseries data, and marks each point as either delayed (data bucket ended before the delay threshold) or not
 */

import {defined} from 'sentry/utils';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function markDelayedData(timeSeries: TimeSeries, delay: number): TimeSeries {
  if (delay === 0) {
    return timeSeries;
  }

  const bucketSize = timeSeries.meta.interval;

  const ingestionDelayTimestamp = Date.now() - delay * 1000;

  // TODO: Since the data is guaranteed to be ordered and we know that only the
  // last few points are affected, we can make this a lot faster by iterating
  // backwards and immediately stopping once we see the first complete point
  return {
    ...timeSeries,
    values: timeSeries.values.map(datum => {
      const bucketEndTimestamp = new Date(datum.timestamp).getTime() + bucketSize;
      const delayed = bucketEndTimestamp >= ingestionDelayTimestamp;

      if (defined(datum.incomplete)) {
        return datum;
      }

      if (!delayed) {
        return datum;
      }

      return {
        ...datum,
        incomplete: true,
      };
    }),
  };
}
