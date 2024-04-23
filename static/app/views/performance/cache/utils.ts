import type {Series} from 'sentry/types/echarts';

export const convertHitRateToMissRate = (hitRateSeries: Series): Series => {
  return {
    ...hitRateSeries,
    seriesName: 'cache_miss_rate()', // TODO - this can just be a discover function
    data: hitRateSeries.data.map(dataPoint => ({
      ...dataPoint,
      value: dataPoint.value ? 1 - dataPoint.value : 0,
    })),
  };
};
