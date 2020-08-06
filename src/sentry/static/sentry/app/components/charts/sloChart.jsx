import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import theme from 'app/utils/theme';

import AreaSeries from './series/areaSeries';
import BaseChart from './baseChart';

const FILLER_NAME = '__filler';

/**
 * A stacked 100% column chart over time
 *
 * See https://exceljet.net/chart-type/100-stacked-bar-chart
 */
export default class SloChart extends React.Component {
  static get defaultProps() {
    // TODO(billyvg): Move these into BaseChart? or get rid completely
    return {
      getDataItemName: ({name}) => name,
      getValue: ({value}) => {
        return Math.floor(value * 10000.0) / 100.0;
      },
      getOtherValue: ({value}) => {
        return Math.floor((1 - value) * 10000.0) / 100.0;
      },
    };
  }

  static propTypes = {
    ...BaseChart.propTypes,

    getDataItemName: PropTypes.func,
    getValue: PropTypes.func,
  };

  getSeries() {
    const {series, getDataItemName, getValue, getOtherValue} = this.props;

    return [
      ...series.map(({seriesName, data}) =>
        AreaSeries({
          barCategoryGap: 0,
          name: seriesName,
          color: theme.alert.success.background,
          lineStyle: {width: 1},
          areaStyle: {opacity: 1},
          smooth: false,
          stack: 'percentageAreaChartStack',
          data: data.map(dataObj => [getDataItemName(dataObj), getValue(dataObj)]),
        })
      ),
      ...series.map(({data}) =>
        AreaSeries({
          barCategoryGap: 0,
          name: 'other',
          color: theme.alert.error.background,
          lineStyle: {width: 1},
          areaStyle: {opacity: 1},
          smooth: false,
          stack: 'percentageAreaChartStack',
          data: data.map(dataObj => [getDataItemName(dataObj), getOtherValue(dataObj)]),
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
            const series = Array.isArray(seriesParams) ? seriesParams : [seriesParams];

            // Filter series that have 0 counts
            const date =
              `${series.length &&
                moment(series[0].axisValue).format('MMM D, YYYY')}<br />` || '';

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
              `<div class="tooltip-date">${date}</div>`,
              '<div class="tooltip-arrow"></div>',
            ].join('');
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
