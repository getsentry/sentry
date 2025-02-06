import type {TimeseriesData} from '../common/types';

/**
 * Given a timeseries and a delay in seconds, goes through the timeseries data, and marks each point as either delayed (data bucket ended before the delay threshold) or not
 */

export function markDelayedData(timeserie: TimeseriesData, delay: number) {
  if (delay === 0) {
    return timeserie;
  }

  const bucketSize = getTimeSeriesBucketSize(timeserie);

  const ingestionDelayTimestamp = Date.now() - delay * 1000;

  // TODO: Since the data is guaranteed to be ordered and we know that only the
  // last few points are affected, we can make this a lot faster by iterating
  // backwards and immediately stopping once we see the first complete point
  return {
    ...timeserie,
    data: timeserie.data.map(datum => {
      const bucketEndTimestamp = new Date(datum.timestamp).getTime() + bucketSize;
      const delayed = bucketEndTimestamp >= ingestionDelayTimestamp;

      return {
        ...datum,
        delayed,
      };
    }),
  };
}

function getTimeSeriesBucketSize(timeseries: TimeseriesData): number {
  const penultimateDatum = timeseries.data.at(-2);
  const finalDatum = timeseries.data.at(-1);

  let bucketSize: number = 0;
  if (penultimateDatum && finalDatum) {
    bucketSize =
      new Date(finalDatum.timestamp).getTime() -
      new Date(penultimateDatum.timestamp).getTime();
  }

  return bucketSize;
}
