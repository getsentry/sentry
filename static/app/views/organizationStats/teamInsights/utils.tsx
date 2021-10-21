import chunk from 'lodash/chunk';
import moment from 'moment';

import BaseChart from 'app/components/charts/baseChart';
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

/**
 * Convert an object with date as the key to a series
 */
export function convertDayValueObjectToSeries(
  data: Record<string, number>
): SeriesDataUnit[] {
  return Object.entries(data).map(([bucket, count]) => ({
    value: count,
    name: new Date(bucket).getTime(),
  }));
}

export const barAxisLabel = (
  dataEntries: number
): React.ComponentProps<typeof BaseChart>['xAxis'] => {
  return {
    splitNumber: dataEntries,
    type: 'category',
    min: 0,
    axisLabel: {
      showMaxLabel: true,
      showMinLabel: true,
      formatter: (date: number) => {
        return moment(new Date(date)).format('MMM D');
      },
    },
  };
};
