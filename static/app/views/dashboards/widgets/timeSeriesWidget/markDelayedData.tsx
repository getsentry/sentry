import type {TimeseriesData} from '../common/types';

/**
 * Given a timeseries and a delay in seconds, goes through the timeseries data, and marks each point as either delayed (data bucket ended before the delay threshold) or not
 */

export function markDelayedData(timeserie: TimeseriesData, delay: number) {
  if (delay === 0) {
    return timeserie;
  }

  const penultimateDatum = timeserie.data.at(-2);
  const finalDatum = timeserie.data.at(-1);

  let bucketSize: number = 0;
  if (penultimateDatum && finalDatum) {
    bucketSize =
      new Date(finalDatum.timestamp).getTime() -
      new Date(penultimateDatum.timestamp).getTime();
  }

  const ingestionDelayTimestamp = Date.now() - delay * 1000;

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
