import {Component} from 'react';
import type {LineSeriesOption} from 'echarts';
import moment from 'moment';

import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import toArray from 'sentry/utils/toArray';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';

const FILLER_NAME = '__filler';

type ChartProps = Omit<React.ComponentProps<typeof BaseChart>, 'css'>;

export type AreaChartSeries = Series & Omit<LineSeriesOption, 'data' | 'name'>;

type DefaultProps = {
  getDataItemName: ({name}: SeriesDataUnit) => SeriesDataUnit['name'];
  getValue: ({value}: SeriesDataUnit, total?: number) => number;
};

type Props = Omit<ChartProps, 'series'> &
  DefaultProps & {
    series: AreaChartSeries[];
    stacked?: boolean;
  };

/**
 * A stacked 100% column chart over time
 *
 * See https://exceljet.net/chart-type/100-stacked-bar-chart
 */
export default class PercentageAreaChart extends Component<Props> {
  static defaultProps: DefaultProps = {
    // TODO(billyvg): Move these into BaseChart? or get rid completely
    getDataItemName: ({name}) => name,
    getValue: ({value}, total) => (!total ? 0 : Math.round((value / total) * 1000) / 10),
  };

  getSeries() {
    const {series, getDataItemName, getValue} = this.props;

    const totalsArray: [string | number, number][] = series.length
      ? series[0].data.map(({name}, i) => [
          name,
          series.reduce((sum, {data}) => sum + data[i].value, 0),
        ])
      : [];
    const totals = new Map<string | number, number>(totalsArray);
    return [
      ...series.map(({seriesName, data}) =>
        AreaSeries({
          name: seriesName,
          lineStyle: {width: 1},
          areaStyle: {opacity: 1},
          smooth: true,
          stack: 'percentageAreaChartStack',
          data: data.map((dataObj: SeriesDataUnit) => [
            getDataItemName(dataObj),
            getValue(dataObj, totals.get(dataObj.name)),
          ]),
        })
      ),
    ];
  }

  render() {
    return (
      <BaseChart
        {...this.props}
        tooltip={{
          formatter: seriesParams => {
            // `seriesParams` can be an array or an object :/
            const series = toArray(seriesParams);

            // Filter series that have 0 counts
            const date =
              `${
                series.length && moment(series[0].data[0]).format('MMM D, YYYY')
              }<br />` || '';

            return [
              '<div class="tooltip-series">',
              series
                .filter(
                  ({seriesName, data}) => data[1] > 0.001 && seriesName !== FILLER_NAME
                )
                .map(
                  ({marker, seriesName, data}) =>
                    `<div><span class="tooltip-label">${marker} <strong>${seriesName}</strong></span> ${data[1]}%</div>`
                )
                .join(''),
              '</div>',
              `<div class="tooltip-footer">${date}</div>`,
              '<div class="tooltip-arrow"></div>',
            ].join('');
          },
        }}
        yAxis={{
          min: 0,
          max: 100,
          type: 'value',
          interval: 25,
          splitNumber: 4,
          data: [0, 25, 50, 100],
          axisLabel: {
            formatter: '{value}%',
          },
        }}
        series={this.getSeries()}
      />
    );
  }
}
