import partition from 'lodash/partition';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function splitSeriesIntoCompleteAndIncomplete(
  timeSeries: TimeSeries
): Array<TimeSeries | undefined> {
  const [completeData, incompleteData] = partition(
    timeSeries.values,
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
