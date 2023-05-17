import {Theme} from '@emotion/react';
import moment from 'moment';

import MarkLine from 'sentry/components/charts/components/markLine';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

export const queryToSeries = (
  data: (Record<string, any> & {interval: string})[],
  groupByProperty: string,
  seriesValueProperty: string,
  startTime?: moment.Moment,
  endTime?: moment.Moment,
  interval?: number,
  zerofillValue?: any
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

export function generateMarkLine(
  title: string,
  position: string,
  data: SeriesDataUnit[],
  theme: Theme
) {
  const index = data.findIndex(item => {
    return (
      Math.abs(moment.duration(moment(item.name).diff(moment(position))).asSeconds()) <
      86400
    );
  });
  return {
    seriesName: title,
    type: 'line',
    color: theme.blue300,
    data: [],
    xAxisIndex: 0,
    yAxisIndex: 0,
    markLine: MarkLine({
      silent: true,
      animation: false,
      lineStyle: {color: theme.blue300, type: 'dotted'},
      data: [
        {
          xAxis: index,
        },
      ],
      label: {
        show: false,
      },
    }),
  };
}

export function generateHorizontalLine(title: string, position: number, theme: Theme) {
  return {
    seriesName: title,
    type: 'line',
    color: theme.blue300,
    data: [],
    xAxisIndex: 0,
    yAxisIndex: 0,
    markLine: MarkLine({
      silent: true,
      animation: false,
      lineStyle: {color: theme.blue300, type: 'dotted'},
      data: [
        {
          yAxis: position,
        },
      ],
      label: {
        show: true,
        position: 'insideStart',
        formatter: title,
      },
    }),
  };
}
