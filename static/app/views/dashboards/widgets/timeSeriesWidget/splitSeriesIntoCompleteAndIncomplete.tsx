import partition from 'lodash/partition';

import type {TimeseriesData} from '../common/types';

export function splitSeriesIntoCompleteAndIncomplete(
  serie: TimeseriesData,
  delay: number
): Array<TimeseriesData | undefined> {
  const markedTimeserie = markDelayedData(serie, delay);

  const [completeData, incompleteData] = partition(markedTimeserie.data, datum =>
    Boolean(datum.delayed)
  );

  // If there is both complete and incomplete data, prepend the incomplete data
  // with the final point from the complete data. This way, when the series are
  // plotted, there's a connecting line between them
  const finalCompletePoint = completeData.at(-1);

  if (incompleteData.length > 0 && finalCompletePoint) {
    incompleteData.unshift({...finalCompletePoint});
  }

  // Discard the delayed property since the split series already communicate
  // that information
  return [
    completeData.length > 0
      ? {
          ...serie,
          data: completeData.map(discardDelayProperty),
        }
      : undefined,
    incompleteData.length > 0
      ? {
          ...serie,
          data: incompleteData.map(discardDelayProperty),
        }
      : undefined,
  ];
}

/**
 * Given a timeseries and a delay in seconds, goes through the timeseries data, and marks each point as either delayed (data bucket ended before the delay threshold) or not
 */
function markDelayedData(timeserie: TimeseriesData, delay: number) {
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
      const delayed = bucketEndTimestamp < ingestionDelayTimestamp;

      return {
        ...datum,
        delayed,
      };
    }),
  };
}

function discardDelayProperty(
  datum: TimeseriesData['data'][number]
): Omit<TimeseriesData['data'][number], 'delayed'> {
  const {delayed: _delayed, ...other} = datum;
  return other;
}
