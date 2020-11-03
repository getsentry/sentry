import React from 'react';
import isEqual from 'lodash/isEqual';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import LineChart from 'app/components/charts/lineChart';
import AreaChart from 'app/components/charts/areaChart';
import StackedAreaChart from 'app/components/charts/stackedAreaChart';
import {Series} from 'app/types/echarts';
import theme from 'app/utils/theme';
import {defined} from 'app/utils';
import {getExactDuration} from 'app/utils/formatters';
import {axisDuration} from 'app/utils/discover/charts';
import {decodeList} from 'app/utils/queryString';

import {YAxis} from './releaseChartControls';

type Props = {
  reloading: boolean;
  utc: boolean | null;
  timeseriesData: Series[];
  zoomRenderProps: any;
  yAxis: YAxis;
  location: Location;
  shouldRecalculateVisibleSeries: boolean;
  onVisibleSeriesRecalculated: () => void;
};

class HealthChart extends React.Component<Props> {
  componentDidMount() {
    if (this.shouldUnselectHealthySeries()) {
      this.props.onVisibleSeriesRecalculated();
      this.handleLegendSelectChanged({selected: {Healthy: false}});
    }
  }

  shouldComponentUpdate(nextProps: Props) {
    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (
      this.props.location.query.unselectedSeries !==
      nextProps.location.query.unselectedSeries
    ) {
      return true;
    }

    if (isEqual(this.props.timeseriesData, nextProps.timeseriesData)) {
      return false;
    }

    return true;
  }

  shouldUnselectHealthySeries(): boolean {
    const {timeseriesData, location, shouldRecalculateVisibleSeries} = this.props;

    const otherAreasThanHealthyArePositive = timeseriesData
      .filter(s => s.seriesName !== 'Healthy')
      .some(s => s.data.some(d => d.value > 0));
    const alreadySomethingUnselected = !!decodeList(location.query.unselectedSeries);

    return (
      shouldRecalculateVisibleSeries &&
      otherAreasThanHealthyArePositive &&
      !alreadySomethingUnselected
    );
  }

  handleLegendSelectChanged = legendChange => {
    const {location} = this.props;
    const {selected} = legendChange;

    const to = {
      ...location,
      query: {
        ...location.query,
        unselectedSeries: Object.keys(selected).filter(key => !selected[key]),
      },
    };

    browserHistory.replace(to);
  };

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

  configureYAxis() {
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
          axisLabel: {
            formatter: value => axisDuration(value * 1000),
            color: theme.gray400,
          },
        };
      case YAxis.SESSIONS:
      case YAxis.USERS:
      default:
        return undefined;
    }
  }

  getChart() {
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
  }

  render() {
    const {utc, timeseriesData, zoomRenderProps, location} = this.props;

    const Chart = this.getChart();

    const seriesSelection = (decodeList(location.query.unselectedSeries) ?? []).reduce(
      (selection, metric) => {
        selection[metric] = false;
        return selection;
      },
      {}
    );

    const legend = {
      right: 22,
      top: 10,
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
      data: timeseriesData.map(d => d.seriesName).reverse(),
      selected: seriesSelection,
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
        onLegendSelectChanged={this.handleLegendSelectChanged}
        transformSinglePointToBar
      />
    );
  }
}

export default HealthChart;
