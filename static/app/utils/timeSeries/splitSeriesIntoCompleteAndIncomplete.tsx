import partition from 'lodash/partition';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {markDelayedData} from './markDelayedData';

export function splitSeriesIntoCompleteAndIncomplete(
  timeSeries: TimeSeries,
  delay: number
): Array<TimeSeries | undefined> {
  const markedTimeserie = markDelayedData(timeSeries, delay);

  const [completeData, incompleteData] = partition(
    markedTimeserie.values,
    datum => !datum.incomplete
  );

  // If there is both complete and incomplete data, prepend the incomplete data
  // with the final point from the complete data. This way, when the series are
  // plotted, there's a connecting line between them
  const finalCompletePoint = completeData.at(-1);

  if (incompleteData.length > 0 && finalCompletePoint) {
    incompleteData.unshift({...finalCompletePoint});
  }

  return [
    completeData.length > 0
      ? {
          ...timeSeries,
          values: completeData,
        }
      : undefined,
    incompleteData.length > 0
      ? {
          ...timeSeries,
          values: incompleteData,
        }
      : undefined,
  ];
}
