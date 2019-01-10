import {max} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import BaseChart from './baseChart';
import MapSeries from './series/mapSeries';

export default class WorldMapChart extends React.Component {
  static propTypes = {
    ...BaseChart.propTypes,
    seriesOptions: PropTypes.object,
  };

  constructor(props) {
    super(props);
    this.state = {
      countryCodesMap: null,
    };
  }

  async componentDidMount() {
    const countryCodesMap = await import(/* webpackChunkName: "countryCodesMap" */ 'app/data/countryCodesMap');

    // eslint-disable-next-line
    this.setState({
      countryCodesMap: countryCodesMap.default,
    });
  }

  render() {
    if (this.state.countryCodesMap === null) {
      return null;
    }

    const {series, seriesOptions, ...props} = this.props;
    const processedSeries = series.map(({seriesName, data, ...options}) => {
      return MapSeries({
        ...seriesOptions,
        ...options,
        mapType: 'world',
        name: seriesName,
        nameMap: this.state.countryCodesMap,
        data,
      });
    });

    // TODO(billy):
    // For absolute values, we want min/max to based on min/max of series
    // Otherwise it should be 0-100
    const maxValue = max(series.map(({data}) => max(data.map(({value}) => value))));

    return (
      <BaseChart
        options={{
          visualMap: {
            left: 'right',
            min: 0,
            max: maxValue,
            inRange: {
              color: [
                '#313695',
                '#4575b4',
                '#74add1',
                '#abd9e9',
                '#e0f3f8',
                '#ffffbf',
                '#fee090',
                '#fdae61',
                '#f46d43',
                '#d73027',
                '#a50026',
              ],
            },
            text: ['High', 'Low'],
            calculable: true,
          },
        }}
        {...props}
        yAxis={null}
        xAxis={null}
        series={processedSeries}
      />
    );
  }
}
