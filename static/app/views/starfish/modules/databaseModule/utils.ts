import moment from 'moment';

import {Series} from 'sentry/types/echarts';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

type Options = {
  data: (Record<string, any> & {interval: string})[];
  groupByProperty: string;
  seriesValueProperty: string;
  endTime?: moment.Moment;
  interval?: number;
  lineType?: 'solid' | 'dashed' | 'dotted';
  startTime?: moment.Moment;
  zerofillValue?: any;
};

export const queryToSeries = (options: Options): Series[] => {
  const seriesMap: Record<string, Series> = {};
  const {
    data,
    groupByProperty,
    seriesValueProperty,
    startTime,
    endTime,
    interval,
    zerofillValue,
    lineType,
  } = options;

  data.forEach(row => {
    const dataEntry = {value: row[seriesValueProperty], name: row.interval};
    if (!seriesMap[row[groupByProperty]]) {
      seriesMap[row[groupByProperty]] = {
        seriesName: row[groupByProperty],
        data: [],
        lineStyle: {type: lineType ?? 'solid'},
      };
    }
    if (dataEntry.value !== undefined) {
      seriesMap[row[groupByProperty]].data.push(dataEntry);
    }
  });
  if (!startTime || !endTime || !interval) {
    return Object.values(seriesMap);
  }
  return Object.values(seriesMap).map(series =>
    zeroFillSeries(
      series,
      moment.duration(interval, 'hours'),
      startTime,
      endTime,
      zerofillValue
    )
  );
};
