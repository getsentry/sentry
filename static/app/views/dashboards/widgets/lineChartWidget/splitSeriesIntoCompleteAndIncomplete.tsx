import partition from 'lodash/partition';

import type {TimeseriesData} from '../common/types';

export function splitSeriesIntoCompleteAndIncomplete(
  serie: TimeseriesData
): (TimeseriesData | undefined)[] {
  const ingestionDelayTimestamp = Date.now() - AVERAGE_INGESTION_DELAY_MS;

  const [completeData, incompleteData] = partition(serie.data, datum => {
    return new Date(datum.timestamp).getTime() < ingestionDelayTimestamp;
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
