import React from 'react';
import {browserHistory} from 'react-router';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import AreaChart from 'app/components/charts/areaChart';
import {ZoomRenderProps} from 'app/components/charts/chartZoom';
import LineChart from 'app/components/charts/lineChart';
import StackedAreaChart from 'app/components/charts/stackedAreaChart';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import {getSeriesSelection} from 'app/components/charts/utils';
import {parseStatsPeriod} from 'app/components/organizations/timeRangeSelector/utils';
import QuestionTooltip from 'app/components/questionTooltip';
import {PlatformKey} from 'app/data/platformCategories';
import {Series} from 'app/types/echarts';
import {defined} from 'app/utils';
import {getUtcDateString} from 'app/utils/dates';
import {axisDuration} from 'app/utils/discover/charts';
import {getExactDuration} from 'app/utils/formatters';
import {decodeScalar} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';
import {displayCrashFreePercent} from 'app/views/releases/utils';

import {
  getSessionTermDescription,
  SessionTerm,
  sessionTerm,
} from '../../../utils/sessionTerm';

import {YAxis} from './releaseChartControls';
import {isOtherSeries, sortSessionSeries} from './utils';

type Props = {
  theme: Theme;
  reloading: boolean;
  timeseriesData: Series[];
  zoomRenderProps: ZoomRenderProps;
  yAxis: YAxis;
  location: Location;
  platform: PlatformKey;
  shouldRecalculateVisibleSeries: boolean;
  onVisibleSeriesRecalculated: () => void;
  title: string;
  help?: string;
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
      .filter(
        s =>
          ![
            sessionTerm.healthy,
            sessionTerm.otherHealthy,
            sessionTerm.otherErrored,
            sessionTerm.otherCrashed,
            sessionTerm.otherAbnormal,
          ].includes(s.seriesName)
      )
      .some(s => s.data.some(d => d.value > 0));
    const alreadySomethingUnselected = !!decodeScalar(location.query.unselectedSeries);

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
    const {theme, yAxis} = this.props;
    switch (yAxis) {
      case YAxis.CRASH_FREE:
        return {
          max: 100,
          scale: true,
          axisLabel: {
            formatter: (value: number) => displayCrashFreePercent(value),
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
        min: getUtcDateString(zoomRenderProps.start),
        max: getUtcDateString(zoomRenderProps.end),
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

  getLegendSeries() {
    const {timeseriesData} = this.props;
    return (
      timeseriesData
        .filter(d => !isOtherSeries(d))
        // we don't want Other Healthy, Other Crashed, etc. to show up in the legend
        .sort(sortSessionSeries)
        .map(d => d.seriesName)
    );
  }

  getLegendSelectedSeries() {
    const {location, yAxis} = this.props;

    const selection = getSeriesSelection(location) ?? {};
    // otherReleases toggles all "other" series (other healthy, other crashed, etc.) at once
    const otherReleasesVisible = !(selection[sessionTerm.otherReleases] === false);

    if (yAxis === YAxis.SESSIONS || yAxis === YAxis.USERS) {
      selection[sessionTerm.otherErrored] =
        !selection?.hasOwnProperty(sessionTerm.errored) && otherReleasesVisible;
      selection[sessionTerm.otherCrashed] =
        !selection?.hasOwnProperty(sessionTerm.crashed) && otherReleasesVisible;
      selection[sessionTerm.otherAbnormal] =
        !selection?.hasOwnProperty(sessionTerm.abnormal) && otherReleasesVisible;
      selection[sessionTerm.otherHealthy] =
        !selection?.hasOwnProperty(sessionTerm.healthy) && otherReleasesVisible;
    }

    if (yAxis === YAxis.CRASH_FREE) {
      selection[sessionTerm.otherCrashFreeSessions] =
        !selection?.hasOwnProperty(sessionTerm['crash-free-sessions']) &&
        otherReleasesVisible;
      selection[sessionTerm.otherCrashFreeUsers] =
        !selection?.hasOwnProperty(sessionTerm['crash-free-users']) &&
        otherReleasesVisible;
    }

    return selection;
  }

  render() {
    const {timeseriesData, zoomRenderProps, title, help} = this.props;

    const Chart = this.getChart();

    const legend = {
      right: 10,
      top: 0,
      data: this.getLegendSeries(),
      selected: this.getLegendSelectedSeries(),
      tooltip: {
        show: true,
        // TODO(ts) tooltip.formatter has incorrect types in echarts 4
        formatter: (params: any): string => {
          const seriesNameDesc = this.getLegendTooltipDescription(params.name ?? '');

          if (!seriesNameDesc) {
            return '';
          }

          return ['<div class="tooltip-description">', seriesNameDesc, '</div>'].join('');
        },
      },
    };

    return (
      <React.Fragment>
        <HeaderTitleLegend>
          {title}
          {help && <QuestionTooltip size="sm" position="top" title={help} />}
        </HeaderTitleLegend>

        <Chart
          legend={legend}
          {...zoomRenderProps}
          series={timeseriesData}
          isGroupedByDate
          seriesOptions={{
            showSymbol: false,
          }}
          grid={{
            left: '10px',
            right: '10px',
            top: '40px',
            bottom: '0px',
          }}
          yAxis={this.configureYAxis()}
          xAxis={this.configureXAxis()}
          tooltip={{valueFormatter: this.formatTooltipValue}}
          onLegendSelectChanged={this.handleLegendSelectChanged}
          transformSinglePointToBar
        />
      </React.Fragment>
    );
  }
}

export default withTheme(HealthChart);
