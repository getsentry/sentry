import {Component} from 'react';
import type {Theme} from '@emotion/react';
import {withTheme} from '@emotion/react';
import type {Location} from 'history';
import round from 'lodash/round';

import type {AreaChartProps} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import StackedAreaChart from 'sentry/components/charts/stackedAreaChart';
import {HeaderTitleLegend, HeaderValue} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {getChartColorPalette} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import type {SessionApiResponse} from 'sentry/types/organization';
import {SessionFieldWithOperation, SessionStatus} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import type {ReleaseProject, ReleaseWithHealth} from 'sentry/types/release';
import {ReleaseComparisonChartType} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import {
  getCountSeries,
  getCrashFreeRateSeries,
  getSessionStatusRateSeries,
  initSessionsChart,
  MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
} from 'sentry/utils/sessions';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';
import {displayCrashFreePercent} from 'sentry/views/releases/utils';

import {
  generateReleaseMarkLines,
  releaseComparisonChartHelp,
  releaseComparisonChartTitles,
  releaseMarkLinesLabels,
} from '../../utils';

type Props = {
  allSessions: SessionApiResponse | null;
  chartType: ReleaseComparisonChartType;
  diff: React.ReactNode;
  loading: boolean;
  location: Location;
  platform: PlatformKey;
  project: ReleaseProject;
  release: ReleaseWithHealth;
  releaseSessions: SessionApiResponse | null;
  reloading: boolean;
  theme: Theme;
  value: React.ReactNode;
  end?: string;
  period?: string | null;
  start?: string;
  utc?: boolean;
};

class ReleaseSessionsChart extends Component<Props> {
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
      case ReleaseComparisonChartType.SESSION_COUNT:
      case ReleaseComparisonChartType.USER_COUNT:
      default:
        return undefined;
    }
  }

  getChart():
    | React.ComponentType<StackedAreaChart['props']>
    | React.ComponentType<AreaChartProps> {
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
      case ReleaseComparisonChartType.USER_COUNT:
        return StackedAreaChart;
    }
  }

  getColors() {
    const {theme, chartType} = this.props;
    const colors = getChartColorPalette(14);
    switch (chartType) {
      case ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
        return [colors[0]!];
      case ReleaseComparisonChartType.HEALTHY_SESSIONS:
        return [theme.green300];
      case ReleaseComparisonChartType.ABNORMAL_SESSIONS:
        return [colors[15]!];
      case ReleaseComparisonChartType.ERRORED_SESSIONS:
        return [colors[12]!];
      case ReleaseComparisonChartType.CRASHED_SESSIONS:
        return [theme.red300];
      case ReleaseComparisonChartType.CRASH_FREE_USERS:
        return [colors[6]!];
      case ReleaseComparisonChartType.HEALTHY_USERS:
        return [theme.green300];
      case ReleaseComparisonChartType.ABNORMAL_USERS:
        return [colors[15]!];
      case ReleaseComparisonChartType.ERRORED_USERS:
        return [colors[12]!];
      case ReleaseComparisonChartType.CRASHED_USERS:
        return [theme.red300];
      case ReleaseComparisonChartType.SESSION_COUNT:
      case ReleaseComparisonChartType.USER_COUNT:
      default:
        return undefined;
    }
  }

  getSeries(chartType: ReleaseComparisonChartType) {
    const {releaseSessions, allSessions, release, location, project, theme} = this.props;
    const countCharts = initSessionsChart(theme);

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
                SessionFieldWithOperation.SESSIONS
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getCrashFreeRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionFieldWithOperation.SESSIONS
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
                SessionFieldWithOperation.SESSIONS,
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
                SessionFieldWithOperation.SESSIONS,
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
                SessionFieldWithOperation.SESSIONS,
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
                SessionFieldWithOperation.SESSIONS,
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
                SessionFieldWithOperation.SESSIONS,
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
                SessionFieldWithOperation.SESSIONS,
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
                SessionFieldWithOperation.SESSIONS,
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
                SessionFieldWithOperation.SESSIONS,
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
                SessionFieldWithOperation.USERS
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getCrashFreeRateSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionFieldWithOperation.USERS
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
                SessionFieldWithOperation.USERS,
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
                SessionFieldWithOperation.USERS,
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
                SessionFieldWithOperation.USERS,
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
                SessionFieldWithOperation.USERS,
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
                SessionFieldWithOperation.USERS,
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
                SessionFieldWithOperation.USERS,
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
                SessionFieldWithOperation.USERS,
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
                SessionFieldWithOperation.USERS,
                SessionStatus.CRASHED
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.SESSION_COUNT:
        return {
          series: [
            {
              ...countCharts[SessionStatus.HEALTHY],
              data: getCountSeries(
                SessionFieldWithOperation.SESSIONS,
                releaseSessions.groups.find(
                  g => g.by['session.status'] === SessionStatus.HEALTHY
                ),
                releaseSessions.intervals
              ),
            },
            {
              ...countCharts[SessionStatus.ERRORED],
              data: getCountSeries(
                SessionFieldWithOperation.SESSIONS,
                releaseSessions.groups.find(
                  g => g.by['session.status'] === SessionStatus.ERRORED
                ),
                releaseSessions.intervals
              ),
            },
            {
              ...countCharts[SessionStatus.ABNORMAL],
              data: getCountSeries(
                SessionFieldWithOperation.SESSIONS,
                releaseSessions.groups.find(
                  g => g.by['session.status'] === SessionStatus.ABNORMAL
                ),
                releaseSessions.intervals
              ),
            },
            {
              ...countCharts[SessionStatus.CRASHED],
              data: getCountSeries(
                SessionFieldWithOperation.SESSIONS,
                releaseSessions.groups.find(
                  g => g.by['session.status'] === SessionStatus.CRASHED
                ),
                releaseSessions.intervals
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.USER_COUNT:
        return {
          series: [
            {
              ...countCharts[SessionStatus.HEALTHY],
              data: getCountSeries(
                SessionFieldWithOperation.USERS,
                releaseSessions.groups.find(
                  g => g.by['session.status'] === SessionStatus.HEALTHY
                ),
                releaseSessions.intervals
              ),
            },
            {
              ...countCharts[SessionStatus.ERRORED],
              data: getCountSeries(
                SessionFieldWithOperation.USERS,
                releaseSessions.groups.find(
                  g => g.by['session.status'] === SessionStatus.ERRORED
                ),
                releaseSessions.intervals
              ),
            },
            {
              ...countCharts[SessionStatus.ABNORMAL],
              data: getCountSeries(
                SessionFieldWithOperation.USERS,
                releaseSessions.groups.find(
                  g => g.by['session.status'] === SessionStatus.ABNORMAL
                ),
                releaseSessions.intervals
              ),
            },
            {
              ...countCharts[SessionStatus.CRASHED],
              data: getCountSeries(
                SessionFieldWithOperation.USERS,
                releaseSessions.groups.find(
                  g => g.by['session.status'] === SessionStatus.CRASHED
                ),
                releaseSessions.intervals
              ),
            },
          ],
          markLines,
        };
      default:
        return {};
    }
  }

  render() {
    const {chartType, period, start, end, utc, value, diff, loading, reloading} =
      this.props;

    const Chart = this.getChart();
    const {series, previousSeries, markLines} = this.getSeries(chartType);

    const legend = {
      right: 10,
      top: 0,
      textStyle: {
        padding: [2, 0, 0, 0],
      },
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

        <ChartZoom period={period} utc={utc} start={start} end={end} usePageDate>
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
              minutesThresholdToDisplaySeconds={MINUTES_THRESHOLD_TO_DISPLAY_SECONDS}
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

export default withTheme(withSentryRouter(ReleaseSessionsChart));
