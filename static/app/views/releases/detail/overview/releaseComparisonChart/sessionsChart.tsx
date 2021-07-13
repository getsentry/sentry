import * as React from 'react';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import {withTheme} from '@emotion/react';

import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import StackedAreaChart from 'app/components/charts/stackedAreaChart';
import {HeaderTitleLegend, HeaderValue} from 'app/components/charts/styles';
import QuestionTooltip from 'app/components/questionTooltip';
import {PlatformKey} from 'app/data/platformCategories';
import {ReleaseComparisonChartType} from 'app/types';
import {Series} from 'app/types/echarts';
import {defined} from 'app/utils';
import {Theme} from 'app/utils/theme';
import {displayCrashFreePercent} from 'app/views/releases/utils';

import {
  releaseComparisonChartHelp,
  releaseComparisonChartLabels,
  releaseMarkLinesLabels,
} from '../../utils';

type Props = {
  theme: Theme;
  series: Series[];
  previousSeries: Series[];
  chartType: ReleaseComparisonChartType;
  platform: PlatformKey;
  value: React.ReactNode;
  diff: React.ReactNode;
  period?: string;
  start?: string;
  end?: string;
  utc?: boolean;
} & WithRouterProps;

class SessionsChart extends React.Component<Props> {
  formatTooltipValue = (value: string | number | null, label?: string) => {
    if (label && Object.values(releaseMarkLinesLabels).includes(label)) {
      return '';
    }

    const {chartType} = this.props;
    if (value === null) {
      return '\u2015';
    }

    switch (chartType) {
      case ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
      case ReleaseComparisonChartType.CRASH_FREE_USERS:
        return defined(value) ? `${value}%` : '\u2015';
      case ReleaseComparisonChartType.SESSION_COUNT:
      case ReleaseComparisonChartType.USER_COUNT:
      default:
        return typeof value === 'number' ? value.toLocaleString() : value;
    }
  };

  configureYAxis() {
    const {theme, chartType} = this.props;
    switch (chartType) {
      case ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
      case ReleaseComparisonChartType.CRASH_FREE_USERS:
        return {
          max: 100,
          scale: true,
          axisLabel: {
            formatter: (value: number) => displayCrashFreePercent(value),
            color: theme.chartLabel,
          },
        };
      case ReleaseComparisonChartType.SESSION_COUNT:
      case ReleaseComparisonChartType.USER_COUNT:
      default:
        return undefined;
    }
  }

  getChart():
    | React.ComponentType<StackedAreaChart['props']>
    | React.ComponentType<AreaChart['props']> {
    const {chartType} = this.props;
    switch (chartType) {
      case ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
      case ReleaseComparisonChartType.CRASH_FREE_USERS:
      default:
        return AreaChart;
      case ReleaseComparisonChartType.SESSION_COUNT:
      case ReleaseComparisonChartType.USER_COUNT:
        return StackedAreaChart;
    }
  }

  render() {
    const {
      series,
      previousSeries,
      chartType,
      router,
      period,
      start,
      end,
      utc,
      value,
      diff,
    } = this.props;

    const Chart = this.getChart();

    const legend = {
      right: 10,
      top: 0,
      // do not show adoption markers in the legend
      data: [...series, ...previousSeries]
        .filter(s => !s.markLine)
        .map(s => s.seriesName),
    };

    return (
      <React.Fragment>
        <HeaderTitleLegend>
          {releaseComparisonChartLabels[chartType]}
          {releaseComparisonChartHelp[chartType] && (
            <QuestionTooltip
              size="sm"
              position="top"
              title={releaseComparisonChartHelp[chartType]}
            />
          )}
        </HeaderTitleLegend>

        <HeaderValue>
          {value} {diff}
        </HeaderValue>

        <ChartZoom
          router={router}
          period={period}
          utc={utc}
          start={start}
          end={end}
          usePageDate
        >
          {zoomRenderProps => (
            <Chart
              legend={legend}
              series={series}
              previousPeriod={previousSeries}
              {...zoomRenderProps}
              grid={{
                left: '10px',
                right: '10px',
                top: '70px',
                bottom: '0px',
              }}
              yAxis={this.configureYAxis()}
              tooltip={{valueFormatter: this.formatTooltipValue}}
              transformSinglePointToBar
              height={240}
            />
          )}
        </ChartZoom>
      </React.Fragment>
    );
  }
}

export default withTheme(withRouter(SessionsChart));
