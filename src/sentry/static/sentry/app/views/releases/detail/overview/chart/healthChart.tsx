import React from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import AreaChart from 'app/components/charts/areaChart';
import LineChart from 'app/components/charts/lineChart';
import StackedAreaChart from 'app/components/charts/stackedAreaChart';
import {getSeriesSelection} from 'app/components/charts/utils';
import {parseStatsPeriod} from 'app/components/organizations/timeRangeSelector/utils';
import {PlatformKey} from 'app/data/platformCategories';
import {Series} from 'app/types/echarts';
import {defined} from 'app/utils';
import {axisDuration} from 'app/utils/discover/charts';
import {getExactDuration} from 'app/utils/formatters';
import {decodeList} from 'app/utils/queryString';
import theme from 'app/utils/theme';

import {
  getSessionTermDescription,
  SessionTerm,
  sessionTerm,
} from '../../../utils/sessionTerm';

import {YAxis} from './releaseChartControls';

type Props = {
  reloading: boolean;
  utc: boolean | null;
  timeseriesData: Series[];
  zoomRenderProps: any;
  yAxis: YAxis;
  location: Location;
  platform: PlatformKey;
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
      .filter(s => s.seriesName !== sessionTerm.healthy)
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
            color: theme.chartLabel,
          },
        };
      case YAxis.SESSION_DURATION:
        return {
          scale: true,
          axisLabel: {
            formatter: value => axisDuration(value * 1000),
            color: theme.chartLabel,
          },
        };
      case YAxis.SESSIONS:
      case YAxis.USERS:
      default:
        return undefined;
    }
  }

  configureXAxis() {
    const {timeseriesData, zoomRenderProps} = this.props;

    if (timeseriesData.every(s => s.data.length === 1)) {
      if (zoomRenderProps.period) {
        const {start, end} = parseStatsPeriod(zoomRenderProps.period, null);

        return {min: start, max: end};
      }

      return {
        min: zoomRenderProps.start,
        max: zoomRenderProps.end,
      };
    }

    return undefined;
  }

  getChart():
    | React.ComponentType<StackedAreaChart['props']>
    | React.ComponentType<AreaChart['props']>
    | React.ComponentType<LineChart['props']> {
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

  getLegendTooltipDescription(serieName: string) {
    const {platform} = this.props;

    switch (serieName) {
      case sessionTerm.crashed:
        return getSessionTermDescription(SessionTerm.CRASHED, platform);
      case sessionTerm.abnormal:
        return getSessionTermDescription(SessionTerm.ABNORMAL, platform);
      case sessionTerm.errored:
        return getSessionTermDescription(SessionTerm.ERRORED, platform);
      case sessionTerm.healthy:
        return getSessionTermDescription(SessionTerm.HEALTHY, platform);
      case sessionTerm['crash-free-users']:
        return getSessionTermDescription(SessionTerm.CRASH_FREE_USERS, platform);
      case sessionTerm['crash-free-sessions']:
        return getSessionTermDescription(SessionTerm.CRASH_FREE_SESSIONS, platform);
      default:
        return '';
    }
  }

  render() {
    const {utc, timeseriesData, zoomRenderProps, location} = this.props;

    const Chart = this.getChart();

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
      selected: getSeriesSelection(location),
      tooltip: {
        show: true,
        formatter: (params: {
          $vars: string[];
          componentType: string;
          legendIndex: number;
          name: string;
        }): string => {
          const seriesNameDesc = this.getLegendTooltipDescription(params.name);

          if (!seriesNameDesc) {
            return '';
          }

          return [
            '<div class="tooltip-description">',
            `<div>${seriesNameDesc}</div>`,
            '</div>',
          ].join('');
        },
      },
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
        xAxis={this.configureXAxis()}
        tooltip={{valueFormatter: this.formatTooltipValue}}
        onLegendSelectChanged={this.handleLegendSelectChanged}
        transformSinglePointToBar
      />
    );
  }
}

export default HealthChart;
