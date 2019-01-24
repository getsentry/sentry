import {max} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import theme from 'app/utils/theme';
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
        aspectScale: 0.85,
        zoom: 1.3,
        center: [10.97, 9.71],
        itemStyle: {
          normal: {
            areaColor: theme.gray1,
            borderColor: theme.borderLighter,
          },
        },
        data,
      });
    });

    // TODO(billy):
    // For absolute values, we want min/max to based on min/max of series
    // Otherwise it should be 0-100
    const maxValue = max(series.map(({data}) => max(data.map(({value}) => value)))) || 1;

    return (
      <BaseChart
        options={{
          backgroundColor: theme.borderLighter,
          visualMap: {
            left: 'right',
            min: 0,
            max: maxValue,
            inRange: {
              color: [theme.purpleLightest, theme.purpleDarkest],
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
