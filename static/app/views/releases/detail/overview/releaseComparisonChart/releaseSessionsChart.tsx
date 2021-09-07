import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {withTheme} from '@emotion/react';
import round from 'lodash/round';

import AreaChart from 'app/components/charts/areaChart';
import ChartZoom from 'app/components/charts/chartZoom';
import StackedAreaChart from 'app/components/charts/stackedAreaChart';
import {HeaderTitleLegend, HeaderValue} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import QuestionTooltip from 'app/components/questionTooltip';
import {PlatformKey} from 'app/data/platformCategories';
import {t} from 'app/locale';
import {
  ReleaseComparisonChartType,
  ReleaseProject,
  ReleaseWithHealth,
  SessionApiResponse,
  SessionField,
  SessionStatus,
} from 'app/types';
import {defined} from 'app/utils';
import {getDuration, getExactDuration} from 'app/utils/formatters';
import {
  getCrashFreeRateSeries,
  getSessionP50Series,
  getSessionStatusRateSeries,
} from 'app/utils/sessions';
import {Theme} from 'app/utils/theme';
import {displayCrashFreePercent, roundDuration} from 'app/views/releases/utils';

import {
  generateReleaseMarkLines,
  releaseComparisonChartHelp,
  releaseComparisonChartTitles,
  releaseMarkLinesLabels,
} from '../../utils';
import {
  fillChartDataFromSessionsResponse,
  initSessionsBreakdownChartData,
} from '../chart/utils';

type Props = {
  theme: Theme;
  release: ReleaseWithHealth;
  project: ReleaseProject;
  releaseSessions: SessionApiResponse | null;
  allSessions: SessionApiResponse | null;
  chartType: ReleaseComparisonChartType;
  platform: PlatformKey;
  value: React.ReactNode;
  diff: React.ReactNode;
  loading: boolean;
  reloading: boolean;
  period?: string;
  start?: string;
  end?: string;
  utc?: boolean;
} & WithRouterProps;

class ReleaseSessionsChart extends React.Component<Props> {
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
      case ReleaseComparisonChartType.HEALTHY_SESSIONS:
      case ReleaseComparisonChartType.ABNORMAL_SESSIONS:
      case ReleaseComparisonChartType.ERRORED_SESSIONS:
      case ReleaseComparisonChartType.CRASHED_SESSIONS:
      case ReleaseComparisonChartType.CRASH_FREE_USERS:
      case ReleaseComparisonChartType.HEALTHY_USERS:
      case ReleaseComparisonChartType.ABNORMAL_USERS:
      case ReleaseComparisonChartType.ERRORED_USERS:
      case ReleaseComparisonChartType.CRASHED_USERS:
        return defined(value) ? `${value}%` : '\u2015';
      case ReleaseComparisonChartType.SESSION_DURATION:
        return defined(value) && typeof value === 'number'
          ? getExactDuration(value, true)
          : '\u2015';
      case ReleaseComparisonChartType.SESSION_COUNT:
      case ReleaseComparisonChartType.USER_COUNT:
      default:
        return typeof value === 'number' ? value.toLocaleString() : value;
    }
  };

  getYAxis() {
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
      case ReleaseComparisonChartType.HEALTHY_SESSIONS:
      case ReleaseComparisonChartType.ABNORMAL_SESSIONS:
      case ReleaseComparisonChartType.ERRORED_SESSIONS:
      case ReleaseComparisonChartType.CRASHED_SESSIONS:
      case ReleaseComparisonChartType.HEALTHY_USERS:
      case ReleaseComparisonChartType.ABNORMAL_USERS:
      case ReleaseComparisonChartType.ERRORED_USERS:
      case ReleaseComparisonChartType.CRASHED_USERS:
        return {
          scale: true,
          axisLabel: {
            formatter: (value: number) => `${round(value, 2)}%`,
            color: theme.chartLabel,
          },
        };
      case ReleaseComparisonChartType.SESSION_DURATION:
        return {
          scale: true,
          axisLabel: {
            formatter: (value: number) => getDuration(value, undefined, true),
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
      case ReleaseComparisonChartType.HEALTHY_SESSIONS:
      case ReleaseComparisonChartType.ABNORMAL_SESSIONS:
      case ReleaseComparisonChartType.ERRORED_SESSIONS:
      case ReleaseComparisonChartType.CRASHED_SESSIONS:
      case ReleaseComparisonChartType.CRASH_FREE_USERS:
      case ReleaseComparisonChartType.HEALTHY_USERS:
      case ReleaseComparisonChartType.ABNORMAL_USERS:
      case ReleaseComparisonChartType.ERRORED_USERS:
      case ReleaseComparisonChartType.CRASHED_USERS:
      default:
        return AreaChart;
      case ReleaseComparisonChartType.SESSION_COUNT:
      case ReleaseComparisonChartType.SESSION_DURATION:
      case ReleaseComparisonChartType.USER_COUNT:
        return StackedAreaChart;
    }
  }

  getColors() {
    const {theme, chartType} = this.props;
    const colors = theme.charts.getColorPalette(14);
    switch (chartType) {
      case ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
        return [colors[0]];
      case ReleaseComparisonChartType.HEALTHY_SESSIONS:
        return [theme.green300];
      case ReleaseComparisonChartType.ABNORMAL_SESSIONS:
        return [colors[15]];
      case ReleaseComparisonChartType.ERRORED_SESSIONS:
        return [colors[12]];
      case ReleaseComparisonChartType.CRASHED_SESSIONS:
        return [theme.red300];
      case ReleaseComparisonChartType.CRASH_FREE_USERS:
        return [colors[6]];
      case ReleaseComparisonChartType.HEALTHY_USERS:
        return [theme.green300];
      case ReleaseComparisonChartType.ABNORMAL_USERS:
        return [colors[15]];
      case ReleaseComparisonChartType.ERRORED_USERS:
        return [colors[12]];
      case ReleaseComparisonChartType.CRASHED_USERS:
        return [theme.red300];
      case ReleaseComparisonChartType.SESSION_COUNT:
      case ReleaseComparisonChartType.SESSION_DURATION:
      case ReleaseComparisonChartType.USER_COUNT:
      default:
        return undefined;
    }
  }

  getSeries(chartType: ReleaseComparisonChartType) {
    const {releaseSessions, allSessions, release, location, project, theme} = this.props;

    if (!releaseSessions) {
      return {};
    }

    const markLines = generateReleaseMarkLines(release, project, theme, location);

    switch (chartType) {
      case ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getCrashFreeRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.SESSIONS
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getCrashFreeRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.SESSIONS
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.HEALTHY_SESSIONS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getSessionStatusRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.SESSIONS,
                SessionStatus.HEALTHY
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getSessionStatusRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.SESSIONS,
                SessionStatus.HEALTHY
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.ABNORMAL_SESSIONS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getSessionStatusRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.SESSIONS,
                SessionStatus.ABNORMAL
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getSessionStatusRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.SESSIONS,
                SessionStatus.ABNORMAL
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.ERRORED_SESSIONS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getSessionStatusRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.SESSIONS,
                SessionStatus.ERRORED
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getSessionStatusRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.SESSIONS,
                SessionStatus.ERRORED
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.CRASHED_SESSIONS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getSessionStatusRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.SESSIONS,
                SessionStatus.CRASHED
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getSessionStatusRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.SESSIONS,
                SessionStatus.CRASHED
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.CRASH_FREE_USERS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getCrashFreeRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.USERS
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getCrashFreeRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.USERS
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.HEALTHY_USERS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getSessionStatusRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.USERS,
                SessionStatus.HEALTHY
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getSessionStatusRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.USERS,
                SessionStatus.HEALTHY
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.ABNORMAL_USERS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getSessionStatusRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.USERS,
                SessionStatus.ABNORMAL
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getSessionStatusRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.USERS,
                SessionStatus.ABNORMAL
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.ERRORED_USERS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getSessionStatusRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.USERS,
                SessionStatus.ERRORED
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getSessionStatusRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.USERS,
                SessionStatus.ERRORED
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.CRASHED_USERS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getSessionStatusRateSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.USERS,
                SessionStatus.CRASHED
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getSessionStatusRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.USERS,
                SessionStatus.CRASHED
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.SESSION_COUNT:
        return {
          series: Object.values(
            fillChartDataFromSessionsResponse({
              response: releaseSessions,
              field: SessionField.SESSIONS,
              groupBy: 'session.status',
              chartData: initSessionsBreakdownChartData(theme),
            })
          ),
          markLines,
        };
      case ReleaseComparisonChartType.SESSION_DURATION:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getSessionP50Series(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.DURATION,
                duration => roundDuration(duration / 1000)
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getSessionP50Series(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.DURATION,
                duration => roundDuration(duration / 1000)
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.USER_COUNT:
        return {
          series: Object.values(
            fillChartDataFromSessionsResponse({
              response: releaseSessions,
              field: SessionField.USERS,
              groupBy: 'session.status',
              chartData: initSessionsBreakdownChartData(theme),
            })
          ),
          markLines,
        };
      default:
        return {};
    }
  }

  render() {
    const {chartType, router, period, start, end, utc, value, diff, loading, reloading} =
      this.props;

    const Chart = this.getChart();
    const {series, previousSeries, markLines} = this.getSeries(chartType);

    const legend = {
      right: 10,
      top: 0,
      data: [...(series ?? []), ...(previousSeries ?? [])].map(s => s.seriesName),
    };

    return (
      <TransitionChart loading={loading} reloading={reloading} height="240px">
        <TransparentLoadingMask visible={reloading} />
        <HeaderTitleLegend aria-label={t('Chart Title')}>
          {releaseComparisonChartTitles[chartType]}
          {releaseComparisonChartHelp[chartType] && (
            <QuestionTooltip
              size="sm"
              position="top"
              title={releaseComparisonChartHelp[chartType]}
            />
          )}
        </HeaderTitleLegend>

        <HeaderValue aria-label={t('Chart Value')}>
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
              series={[...(series ?? []), ...(markLines ?? [])]}
              previousPeriod={previousSeries ?? []}
              {...zoomRenderProps}
              grid={{
                left: '10px',
                right: '10px',
                top: '70px',
                bottom: '0px',
              }}
              yAxis={this.getYAxis()}
              tooltip={{valueFormatter: this.formatTooltipValue}}
              colors={this.getColors()}
              transformSinglePointToBar
              height={240}
            />
          )}
        </ChartZoom>
      </TransitionChart>
    );
  }
}

export default withTheme(withRouter(ReleaseSessionsChart));
