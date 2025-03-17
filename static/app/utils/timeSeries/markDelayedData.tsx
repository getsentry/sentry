/**
 * Given a timeseries and a delay in seconds, goes through the timeseries data, and marks each point as either delayed (data bucket ended before the delay threshold) or not
 */

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function markDelayedData(timeSeries: TimeSeries, delay: number) {
  if (delay === 0) {
    return timeSeries;
  }

  const bucketSize = getTimeSeriesBucketSize(timeSeries);

  const ingestionDelayTimestamp = Date.now() - delay * 1000;

  // TODO: Since the data is guaranteed to be ordered and we know that only the
  // last few points are affected, we can make this a lot faster by iterating
  // backwards and immediately stopping once we see the first complete point
  return {
    ...timeSeries,
    data: timeSeries.data.map(datum => {
      const bucketEndTimestamp = new Date(datum.timestamp).getTime() + bucketSize;
      const delayed = bucketEndTimestamp >= ingestionDelayTimestamp;

      return {
        ...datum,
        delayed,
      };
    }),
  };
}

function getTimeSeriesBucketSize(timeSeries: TimeSeries): number {
  const penultimateDatum = timeSeries.data.at(-2);
  const finalDatum = timeSeries.data.at(-1);

  let bucketSize = 0;
  if (penultimateDatum && finalDatum) {
    bucketSize =
      new Date(finalDatum.timestamp).getTime() -
      new Date(penultimateDatum.timestamp).getTime();
  }

  return bucketSize;
}
