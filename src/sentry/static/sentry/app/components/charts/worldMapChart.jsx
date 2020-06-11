import max from 'lodash/max';
import PropTypes from 'prop-types';
import React from 'react';

import theme from 'app/utils/theme';

import BaseChart from './baseChart';
import MapSeries from './series/mapSeries';
import VisualMap from './components/visualMap';

export default class WorldMapChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,
    seriesOptions: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      countryToCodeMap: null,
    };
  }

  async componentDidMount() {
    const countryToCodeMap = await import(
      /* webpackChunkName: "countryCodesMap" */ 'app/data/countryCodesMap'
    );

    // eslint-disable-next-line
    this.setState({
      countryToCodeMap: countryToCodeMap.default,
      codeToCountryMap: Object.entries(countryToCodeMap.default).reduce(
        (acc, [country, code]) => ({
          ...acc,
          [code]: country,
        }),
        {}
      ),
    });
  }

  render() {
    if (this.state.countryToCodeMap === null) {
      return null;
    }

    const {series, seriesOptions, ...props} = this.props;
    const processedSeries = series.map(({seriesName, data, ...options}) =>
      MapSeries({
        ...seriesOptions,
        ...options,
        mapType: 'world',
        name: seriesName,
        nameMap: this.state.countryToCodeMap,
        aspectScale: 0.85,
        zoom: 1.3,
        center: [10.97, 9.71],
        itemStyle: {
          normal: {
            areaColor: theme.gray400,
            borderColor: theme.borderLighter,
          },
          emphasis: {
            areaColor: theme.orange300,
          },
        },
        label: {
          emphasis: {
            show: false,
          },
        },
        data,
      })
    );

    // TODO(billy):
    // For absolute values, we want min/max to based on min/max of series
    // Otherwise it should be 0-100
    const maxValue = max(series.map(({data}) => max(data.map(({value}) => value)))) || 1;

    return (
      <BaseChart
        options={{
          backgroundColor: theme.borderLighter,
          visualMap: VisualMap({
            left: 'right',
            min: 0,
            max: maxValue,
            inRange: {
              color: [theme.purpleLightest, theme.purpleDarkest],
            },
            text: ['High', 'Low'],

            // Whether show handles, which can be dragged to adjust "selected range".
            // False because the handles are pretty ugly
            calculable: false,
          }),
        }}
        {...props}
        yAxis={null}
        xAxis={null}
        series={processedSeries}
        tooltip={{
          formatter: ({marker, name, value}) => {
            // If value is NaN, don't show anything because we won't have a country code either
            if (isNaN(value)) {
              return '';
            }

            // `value` should be a number
            const formattedValue =
              typeof value === 'number' ? value.toLocaleString() : '';
            const countryOrCode = this.state.codeToCountryMap[name] || name;

            return [
              `<div class="tooltip-series tooltip-series-solo">
                 <div><span class="tooltip-label">${marker} <strong>${countryOrCode}</strong></span> ${formattedValue}</div>
              </div>`,
              '<div class="tooltip-arrow"></div>',
            ].join('');
          },
        }}
      />
    );
  }
}
