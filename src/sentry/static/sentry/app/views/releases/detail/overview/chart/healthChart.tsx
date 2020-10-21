import { Component } from 'react';
import isEqual from 'lodash/isEqual';

import LineChart from 'app/components/charts/lineChart';
import AreaChart from 'app/components/charts/areaChart';
import StackedAreaChart from 'app/components/charts/stackedAreaChart';
import {Series} from 'app/types/echarts';
import theme from 'app/utils/theme';
import {defined} from 'app/utils';
import {getExactDuration} from 'app/utils/formatters';

import {YAxis} from './releaseChartControls';

type Props = {
  reloading: boolean;
  utc: boolean | null;
  timeseriesData: Series[];
  zoomRenderProps: any;
  yAxis: YAxis;
};

class HealthChart extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (isEqual(this.props.timeseriesData, nextProps.timeseriesData)) {
      return false;
    }

    return true;
  }

  formatTooltipValue = (value: string | number | null) => {
    const {yAxis} = this.props;
    switch (yAxis) {
      case YAxis.SESSION_DURATION:
        return typeof value === 'number' ? getExactDuration(value, true) : '\u2015';
      case YAxis.CRASH_FREE:
        return defined(value) ? `${value}%` : '\u2015';
      case YAxis.SESSIONS:
      case YAxis.USERS:
      default:
        return typeof value === 'number' ? value.toLocaleString() : value;
    }
  };

  configureYAxis = () => {
    const {yAxis} = this.props;
    switch (yAxis) {
      case YAxis.CRASH_FREE:
        return {
          max: 100,
          scale: true,
          axisLabel: {
            formatter: '{value}%',
            color: theme.gray400,
          },
        };
      case YAxis.SESSION_DURATION:
        return {
          scale: true,
        };
      case YAxis.SESSIONS:
      case YAxis.USERS:
      default:
        return undefined;
    }
  };

  getChart = () => {
    const {yAxis} = this.props;
    switch (yAxis) {
      case YAxis.SESSION_DURATION:
        return AreaChart;
      case YAxis.SESSIONS:
      case YAxis.USERS:
        return StackedAreaChart;
      case YAxis.CRASH_FREE:
      default:
        return LineChart;
    }
  };

  render() {
    const {utc, timeseriesData, zoomRenderProps} = this.props;
    const Chart = this.getChart();

    const legend = {
      right: 16,
      top: 12,
      selectedMode: false,
      icon: 'circle',
      itemHeight: 8,
      itemWidth: 8,
      itemGap: 12,
      align: 'left',
      textStyle: {
        verticalAlign: 'top',
        fontSize: 11,
        fontFamily: 'Rubik',
      },
      data: timeseriesData.map(d => d.seriesName),
    };

    return (
      <Chart
        legend={legend}
        utc={utc}
        {...zoomRenderProps}
        series={timeseriesData}
        isGroupedByDate
        seriesOptions={{
          showSymbol: false,
        }}
        grid={{
          left: '24px',
          right: '24px',
          top: '32px',
          bottom: '12px',
        }}
        yAxis={this.configureYAxis()}
        tooltip={{valueFormatter: this.formatTooltipValue}}
      />
    );
  }
}

export default HealthChart;
