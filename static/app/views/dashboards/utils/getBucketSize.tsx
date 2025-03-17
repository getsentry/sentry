import type {Series} from 'sentry/types/echarts';

export const getBucketSize = (series: Series[] | undefined) => {
  if (!series || series.length < 2) {
    return 0;
  }

  return Number(series[0]!.data[1]?.name) - Number(series[0]!.data[0]?.name);
};
