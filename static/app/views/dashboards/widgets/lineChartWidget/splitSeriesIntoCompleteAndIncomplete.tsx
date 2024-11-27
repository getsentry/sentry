import partition from 'lodash/partition';

import type {TimeseriesData} from '../common/types';

export function splitSeriesIntoCompleteAndIncomplete(
  serie: TimeseriesData
): (TimeseriesData | undefined)[] {
  const penultimateDatum = serie.data.at(-2);
  const finalDatum = serie.data.at(-1);

  let bucketSize: number = 0;
  if (penultimateDatum && finalDatum) {
    bucketSize =
      new Date(finalDatum.timestamp).getTime() -
      new Date(penultimateDatum.timestamp).getTime();
  }

  const ingestionDelayTimestamp = Date.now() - AVERAGE_INGESTION_DELAY_MS;

  const [completeData, incompleteData] = partition(serie.data, datum => {
    const bucketEndTimestamp = new Date(datum.timestamp).getTime() + bucketSize;
    return bucketEndTimestamp < ingestionDelayTimestamp;
  });

  const finalCompletePoint = completeData.at(-1);

  if (incompleteData.length > 0 && finalCompletePoint) {
    incompleteData.unshift({...finalCompletePoint});
  }

  return [
    completeData.length > 0
      ? {
          ...serie,
          data: completeData,
        }
      : undefined,
    incompleteData.length > 0
      ? {
          ...serie,
          data: incompleteData,
        }
      : undefined,
  ];
}

const AVERAGE_INGESTION_DELAY_MS = 90_000;
