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

/**
 * Takes a sorted array of trend items and groups them by worst/better/no chagne
 */
export function groupByTrend<T extends {trend: number}>(data: T[]): T[] {
  const worseItems = data.filter(x => Math.round(x.trend) < 0);
  const betterItems = data.filter(x => Math.round(x.trend) > 0);
  const zeroItems = data.filter(x => Math.round(x.trend) === 0);
  return [...worseItems, ...betterItems, ...zeroItems];
}
