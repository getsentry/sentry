import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';

const FILLER_NAME = '__filler';

/**
 * A stacked 100% column chart over time
 *
 * See https://exceljet.net/chart-type/100-stacked-bar-chart
 */
export default class PercentageAreaChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,

    getDataItemName: PropTypes.func,
    getValue: PropTypes.func,
  };

  static get defaultProps() {
    // TODO(billyvg): Move these into BaseChart? or get rid completely
    return {
      getDataItemName: ({name}) => name,
      getValue: ({name, value}, total) =>
        !total ? 0 : Math.round((value / total) * 1000) / 10,
    };
  }

  getSeries() {
    const {series, getDataItemName, getValue} = this.props;

    const totalsArray = series.length
      ? series[0].data.map(({name, value}, i) => {
          return [name, series.reduce((sum, {data}) => sum + data[i].value, 0)];
        })
      : [];
    const totals = new Map(totalsArray);
    return [
      ...series.map(({seriesName, data}) =>
        AreaSeries({
          barCategoryGap: 0,
          name: seriesName,
          lineStyle: {width: 1},
          areaStyle: {opacity: 1},
          smooth: true,
          stack: 'percentageAreaChartStack',
          data: data.map(dataObj => [
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
          // Make sure tooltip is inside of chart (because of overflow: hidden)
          confine: true,
          formatter: seriesParams => {
            // `seriesParams` can be an array or an object :/
            const series = Array.isArray(seriesParams) ? seriesParams : [seriesParams];

            // Filter series that have 0 counts
            const date =
              `${series.length &&
                moment(series[0].axisValue).format('MMM D, YYYY')}<br />` || '';
            return `${date} ${series
              .filter(
                ({seriesName, data}) => data[1] > 0.001 && seriesName !== FILLER_NAME
              )
              .map(
                ({marker, seriesName, data}) =>
                  `${marker} ${seriesName}:  <strong>${data[1]}</strong>%`
              )
              .join('<br />')}`;
          },
        }}
        xAxis={{boundaryGap: true}}
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
