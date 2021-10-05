import chunk from 'lodash/chunk';

import {SeriesDataUnit} from 'app/types/echarts';

/**
 * Buckets a week of sequential days into one data unit
 */
export function convertDaySeriesToWeeks(data: SeriesDataUnit[]): SeriesDataUnit[] {
  const sortedData = data.sort(
    (a, b) => new Date(a.name).getTime() - new Date(b.name).getTime()
  );
  return chunk(sortedData, 7).map(week => {
    return {
      name: week[0].name,
      value: week.reduce((total, currentData) => total + currentData.value, 0),
    };
  });
}
