import React from 'react';

import Highcharts from 'highcharts';
import {
  HighchartsChart, withHighcharts, Chart, XAxis, YAxis, Title, Legend, LineSeries, RangeSelector,
  SplineSeries, AreaSeries, AreaRangeSeries, Tooltip
} from 'react-jsx-highcharts';

import moment from 'moment';

const { obj } = require('./tempData.js');
const RED = '#FF0000';
const WHITE = '#FFFFFF';

class highchartsDiscoverWrapper extends React.Component {

    render() {

        let transformedData = obj['data'].map(({time, aggregate}) => {
            return [moment(time), aggregate]
        })

        return (
            <HighchartsDiscoverWrapper>
                <HighchartsDiscover data={transformedData}/>
            </HighchartsDiscoverWrapper>
        )
    }
}