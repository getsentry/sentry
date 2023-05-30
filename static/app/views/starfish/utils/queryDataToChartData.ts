import moment, {Moment} from 'moment';

import {Series} from 'sentry/types/echarts';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

export function queryDataToChartData<T>(
  data: ({interval: string} & T)[],
  startTime: Moment,
  endTime: Moment,
  seriesOptions: Partial<Series> = {}
): Record<keyof T, Series> {
  const series: Record<string, Series> = {};
  if (data.length > 0) {
    Object.keys(data[0])
      .filter(key => key !== 'interval')
      .forEach(key => {
        series[key] = {data: [], seriesName: `${key}()`, ...seriesOptions};
      });
  }
  data.forEach(point => {
    Object.keys(point).forEach(key => {
      if (key !== 'interval') {
        series[key].data.push({
          name: point.interval,
          value: point[key],
        });
      }
    });
  });

  Object.entries(series).forEach(([seriesKey, s]) => {
    series[seriesKey] = zeroFillSeries(
      s,
      moment.duration(12, 'hours'),
      startTime,
      endTime
    );
  });
  return series as Record<keyof T, Series>;
}
