import React from 'react';
import isEqual from 'lodash/isEqual';

import LineChart from 'app/components/charts/lineChart';
import AreaChart from 'app/components/charts/areaChart';
import {Series} from 'app/types/echarts';
import theme from 'app/utils/theme';
import {defined} from 'app/utils';
import {t} from 'app/locale';

import {YAxis} from './releaseChartControls';

type Props = {
  reloading: boolean;
  utc: boolean;
  releaseSeries: Series[];
  timeseriesData: Series[];
  zoomRenderProps: any;
  yAxis: YAxis;
};

class ReleaseChart extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (
      isEqual(this.props.timeseriesData, nextProps.timeseriesData) &&
      isEqual(this.props.releaseSeries, nextProps.releaseSeries)
    ) {
      return false;
    }

    return true;
  }

  formatTooltipValue = (value: string | number | null) => {
    const {yAxis} = this.props;
    switch (yAxis) {
      case 'sessionDuration':
        return defined(value) ? `${value}${t('s')}` : '-';
      case 'crashFree':
        return defined(value) ? `${value}%` : '-';
      case 'sessions':
      case 'users':
      default:
        return typeof value === 'number' ? value.toLocaleString() : value;
    }
  };

  render() {
    const {utc, releaseSeries, timeseriesData, yAxis, zoomRenderProps} = this.props;
    const Chart =
      yAxis === 'crashFree' || yAxis === 'sessionDuration' ? AreaChart : LineChart;

    const legend = {
      right: 16,
      top: 4,
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
        series={[...timeseriesData, ...releaseSeries]}
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
        yAxis={
          yAxis === 'crashFree'
            ? {
                max: 100,
                scale: true,
                axisLabel: {
                  formatter: '{value}%',
                  color: theme.gray1,
                },
              }
            : undefined
        }
        tooltip={{valueFormatter: this.formatTooltipValue}}
      />
    );
  }
}

export default ReleaseChart;
