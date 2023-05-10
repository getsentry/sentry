import moment from 'moment';

import {Series} from 'sentry/types/echarts';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

const INTERVAL = 12;

export const queryToSeries = (
  data: (Record<string, any> & {interval: string})[],
  groupByProperty: string,
  seriesValueProperty: string,
  startTime: moment.Moment,
  endTime: moment.Moment
): Series[] => {
  const seriesMap: Record<string, Series> = {};

  data.forEach(row => {
    const dataEntry = {value: row[seriesValueProperty], name: row.interval};
    if (!seriesMap[row[groupByProperty]]) {
      seriesMap[row[groupByProperty]] = {
        seriesName: row[groupByProperty],
        data: [],
      };
    }
    if (dataEntry.value) {
      seriesMap[row[groupByProperty]].data.push(dataEntry);
    }
  });
  return Object.values(seriesMap).map(series =>
    zeroFillSeries(series, moment.duration(INTERVAL, 'hours'), startTime, endTime)
  );
};
