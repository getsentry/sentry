import partition from 'lodash/partition';

import type {TimeSeries, TimeSeriesItem} from '../common/types';

import {markDelayedData} from './markDelayedData';

export function splitSeriesIntoCompleteAndIncomplete(
  timeSeries: TimeSeries,
  delay: number
): Array<TimeSeries | undefined> {
  const markedTimeserie = markDelayedData(timeSeries, delay);

  const [completeData, incompleteData] = partition(
    markedTimeserie.data,
    datum => !datum.delayed
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
          ...timeSeries,
          data: completeData.map(discardDelayProperty),
        }
      : undefined,
    incompleteData.length > 0
      ? {
          ...timeSeries,
          data: incompleteData.map(discardDelayProperty),
        }
      : undefined,
  ];
}

function discardDelayProperty(
  datum: TimeSeriesItem
): Omit<TimeSeries['data'][number], 'delayed'> {
  const {delayed: _delayed, ...other} = datum;
  return other;
}
