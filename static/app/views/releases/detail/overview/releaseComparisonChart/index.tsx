import {Fragment, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {Client} from 'app/api';
import ErrorPanel from 'app/components/charts/errorPanel';
import {ChartContainer} from 'app/components/charts/styles';
import Count from 'app/components/count';
import NotAvailable from 'app/components/notAvailable';
import {Panel, PanelTable} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import Radio from 'app/components/radio';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {PlatformKey} from 'app/data/platformCategories';
import {IconArrow, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {
  Organization,
  ReleaseComparisonChartType,
  ReleaseProject,
  ReleaseWithHealth,
  SessionApiResponse,
  SessionField,
  SessionStatus,
} from 'app/types';
import {defined} from 'app/utils';
import {formatPercentage} from 'app/utils/formatters';
import {decodeList, decodeScalar} from 'app/utils/queryString';
import {
  getCount,
  getCrashFreeRate,
  getCrashFreeRateSeries,
  getSessionStatusRate,
  getSessionStatusRateSeries,
} from 'app/utils/sessions';
import {Color, Theme} from 'app/utils/theme';
import {QueryResults} from 'app/utils/tokenizeSearch';
import {
  displayCrashFreeDiff,
  displayCrashFreePercent,
  displaySessionStatusPercent,
  getReleaseBounds,
  getReleaseParams,
} from 'app/views/releases/utils';

import {generateReleaseMarkLines, releaseComparisonChartLabels} from '../../utils';
import {
  fillChartDataFromSessionsResponse,
  initSessionsBreakdownChartData,
} from '../chart/utils';

import ReleaseEventsChart from './releaseEventsChart';
import ReleaseSessionsChart from './releaseSessionsChart';

type ComparisonRow = {
  type: ReleaseComparisonChartType;
  thisRelease: React.ReactNode;
  allReleases: React.ReactNode;
  diff: React.ReactNode;
  diffDirection: 'up' | 'down' | null;
  diffColor: Color | null;
};

type Props = {
  release: ReleaseWithHealth;
  project: ReleaseProject;
  releaseSessions: SessionApiResponse | null;
  allSessions: SessionApiResponse | null;
  platform: PlatformKey;
  location: Location;
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  theme: Theme;
  api: Client;
  organization: Organization;
};

type EventsTotals = {
  allErrorCount: number;
  releaseErrorCount: number;
  allTransactionCount: number;
  releaseTransactionCount: number;
  releaseFailureRate: number;
  allFailureRate: number;
} | null;

function ReleaseComparisonChart({
  release,
  project,
  releaseSessions,
  allSessions,
  platform,
  location,
  loading,
  reloading,
  errored,
  theme,
  api,
  organization,
}: Props) {
  const [eventsTotals, setEventsTotals] = useState<EventsTotals>(null);

  const {
    statsPeriod: period,
    start,
    end,
    utc,
  } = getReleaseParams({
    location,
    releaseBounds: getReleaseBounds(release),
    defaultStatsPeriod: DEFAULT_STATS_PERIOD, // this will be removed once we get rid off legacy release details
    allowEmptyPeriod: true,
  });

  useEffect(() => {
    fetchEventsTotals();
  }, [period, start, end, organization.slug, location]);

  async function fetchEventsTotals() {
    const url = `/organizations/${organization.slug}/eventsv2/`;
    const commonQuery = {
      environment: decodeList(location.query.environment),
      project: decodeList(location.query.project),
      start,
      end,
      ...(period ? {statsPeriod: period} : {}),
    };

    try {
      const [
        releaseTransactionTotals,
        allTransactionTotals,
        releaseErrorTotals,
        allErrorTotals,
      ] = await Promise.all([
        api.requestPromise(url, {
          query: {
            field: ['failure_rate()', 'count()'],
            query: new QueryResults([
              'event.type:transaction',
              `release:${release.version}`,
            ]).formatString(),
            ...commonQuery,
          },
        }),
        api.requestPromise(url, {
          query: {
            field: ['failure_rate()', 'count()'],
            query: new QueryResults(['event.type:transaction']).formatString(),
            ...commonQuery,
          },
        }),
        api.requestPromise(url, {
          query: {
            field: ['count()'],
            query: new QueryResults([
              'event.type:error',
              `release:${release.version}`,
            ]).formatString(),
            ...commonQuery,
          },
        }),
        api.requestPromise(url, {
          query: {
            field: ['count()'],
            query: new QueryResults(['event.type:error']).formatString(),
            ...commonQuery,
          },
        }),
      ]);

      setEventsTotals({
        allErrorCount: allErrorTotals.data[0].count,
        releaseErrorCount: releaseErrorTotals.data[0].count,
        allTransactionCount: allTransactionTotals.data[0].count,
        releaseTransactionCount: releaseTransactionTotals.data[0].count,
        releaseFailureRate: releaseTransactionTotals.data[0].failure_rate,
        allFailureRate: allTransactionTotals.data[0].failure_rate,
      });
    } catch (err) {
      setEventsTotals(null);
      Sentry.captureException(err);
    }
  }

  const activeChart = decodeScalar(
    location.query.chart,
    ReleaseComparisonChartType.CRASH_FREE_SESSIONS
  ) as ReleaseComparisonChartType;

  const releaseCrashFreeSessions = getCrashFreeRate(
    releaseSessions?.groups,
    SessionField.SESSIONS
  );
  const allCrashFreeSessions = getCrashFreeRate(
    allSessions?.groups,
    SessionField.SESSIONS
  );
  const diffCrashFreeSessions =
    defined(releaseCrashFreeSessions) && defined(allCrashFreeSessions)
      ? releaseCrashFreeSessions - allCrashFreeSessions
      : null;

  const releaseHealthySessions = getSessionStatusRate(
    releaseSessions?.groups,
    SessionField.SESSIONS,
    SessionStatus.HEALTHY
  );
  const allHealthySessions = getSessionStatusRate(
    allSessions?.groups,
    SessionField.SESSIONS,
    SessionStatus.HEALTHY
  );
  const diffHealthySessions =
    defined(releaseHealthySessions) && defined(allHealthySessions)
      ? releaseHealthySessions - allHealthySessions
      : null;

  const releaseAbnormalSessions = getSessionStatusRate(
    releaseSessions?.groups,
    SessionField.SESSIONS,
    SessionStatus.ABNORMAL
  );
  const allAbnormalSessions = getSessionStatusRate(
    allSessions?.groups,
    SessionField.SESSIONS,
    SessionStatus.ABNORMAL
  );
  const diffAbnormalSessions =
    defined(releaseAbnormalSessions) && defined(allAbnormalSessions)
      ? releaseAbnormalSessions - allAbnormalSessions
      : null;

  const releaseErroredSessions = getSessionStatusRate(
    releaseSessions?.groups,
    SessionField.SESSIONS,
    SessionStatus.ERRORED
  );
  const allErroredSessions = getSessionStatusRate(
    allSessions?.groups,
    SessionField.SESSIONS,
    SessionStatus.ERRORED
  );
  const diffErroredSessions =
    defined(releaseErroredSessions) && defined(allErroredSessions)
      ? releaseErroredSessions - allErroredSessions
      : null;

  const releaseCrashedSessions = getSessionStatusRate(
    releaseSessions?.groups,
    SessionField.SESSIONS,
    SessionStatus.CRASHED
  );
  const allCrashedSessions = getSessionStatusRate(
    allSessions?.groups,
    SessionField.SESSIONS,
    SessionStatus.CRASHED
  );
  const diffCrashedSessions =
    defined(releaseCrashedSessions) && defined(allCrashedSessions)
      ? releaseCrashedSessions - allCrashedSessions
      : null;

  const releaseCrashFreeUsers = getCrashFreeRate(
    releaseSessions?.groups,
    SessionField.USERS
  );
  const allCrashFreeUsers = getCrashFreeRate(allSessions?.groups, SessionField.USERS);
  const diffCrashFreeUsers =
    defined(releaseCrashFreeUsers) && defined(allCrashFreeUsers)
      ? releaseCrashFreeUsers - allCrashFreeUsers
      : null;

  const releaseHealthyUsers = getSessionStatusRate(
    releaseSessions?.groups,
    SessionField.USERS,
    SessionStatus.HEALTHY
  );
  const allHealthyUsers = getSessionStatusRate(
    allSessions?.groups,
    SessionField.USERS,
    SessionStatus.HEALTHY
  );
  const diffHealthyUsers =
    defined(releaseHealthyUsers) && defined(allHealthyUsers)
      ? releaseHealthyUsers - allHealthyUsers
      : null;

  const releaseAbnormalUsers = getSessionStatusRate(
    releaseSessions?.groups,
    SessionField.USERS,
    SessionStatus.ABNORMAL
  );
  const allAbnormalUsers = getSessionStatusRate(
    allSessions?.groups,
    SessionField.USERS,
    SessionStatus.ABNORMAL
  );
  const diffAbnormalUsers =
    defined(releaseAbnormalUsers) && defined(allAbnormalUsers)
      ? releaseAbnormalUsers - allAbnormalUsers
      : null;

  const releaseErroredUsers = getSessionStatusRate(
    releaseSessions?.groups,
    SessionField.USERS,
    SessionStatus.ERRORED
  );
  const allErroredUsers = getSessionStatusRate(
    allSessions?.groups,
    SessionField.USERS,
    SessionStatus.ERRORED
  );
  const diffErroredUsers =
    defined(releaseErroredUsers) && defined(allErroredUsers)
      ? releaseErroredUsers - allErroredUsers
      : null;

  const releaseCrashedUsers = getSessionStatusRate(
    releaseSessions?.groups,
    SessionField.USERS,
    SessionStatus.CRASHED
  );
  const allCrashedUsers = getSessionStatusRate(
    allSessions?.groups,
    SessionField.USERS,
    SessionStatus.CRASHED
  );
  const diffCrashedUsers =
    defined(releaseCrashedUsers) && defined(allCrashedUsers)
      ? releaseCrashedUsers - allCrashedUsers
      : null;

  const releaseSessionsCount = getCount(releaseSessions?.groups, SessionField.SESSIONS);
  const allSessionsCount = getCount(allSessions?.groups, SessionField.SESSIONS);

  const releaseUsersCount = getCount(releaseSessions?.groups, SessionField.USERS);
  const allUsersCount = getCount(allSessions?.groups, SessionField.USERS);

  const diffFailure =
    eventsTotals?.releaseFailureRate && eventsTotals?.allFailureRate
      ? eventsTotals.releaseFailureRate - eventsTotals.allFailureRate
      : null;

  // TODO(release-comparison): conditional based on sessions/transactions/discover existence
  const charts: ComparisonRow[] = [
    {
      type: ReleaseComparisonChartType.CRASH_FREE_SESSIONS,
      thisRelease: defined(releaseCrashFreeSessions)
        ? displayCrashFreePercent(releaseCrashFreeSessions)
        : null,
      allReleases: defined(allCrashFreeSessions)
        ? displayCrashFreePercent(allCrashFreeSessions)
        : null,
      diff: defined(diffCrashFreeSessions)
        ? displayCrashFreeDiff(diffCrashFreeSessions, releaseCrashFreeSessions)
        : null,
      diffDirection: diffCrashFreeSessions
        ? diffCrashFreeSessions > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: diffCrashFreeSessions
        ? diffCrashFreeSessions > 0
          ? 'green300'
          : 'red300'
        : null,
    },
    {
      type: ReleaseComparisonChartType.HEALTHY_SESSIONS,
      thisRelease: defined(releaseHealthySessions)
        ? displaySessionStatusPercent(releaseHealthySessions)
        : null,
      allReleases: defined(allHealthySessions)
        ? displaySessionStatusPercent(allHealthySessions)
        : null,
      diff: defined(diffHealthySessions)
        ? displaySessionStatusPercent(diffHealthySessions)
        : null,
      diffDirection: diffHealthySessions
        ? diffHealthySessions > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: diffHealthySessions
        ? diffHealthySessions > 0
          ? 'green300'
          : 'red300'
        : null,
    },
    {
      type: ReleaseComparisonChartType.ABNORMAL_SESSIONS,
      thisRelease: defined(releaseAbnormalSessions)
        ? displaySessionStatusPercent(releaseAbnormalSessions)
        : null,
      allReleases: defined(allAbnormalSessions)
        ? displaySessionStatusPercent(allAbnormalSessions)
        : null,
      diff: defined(diffAbnormalSessions)
        ? displaySessionStatusPercent(diffAbnormalSessions)
        : null,
      diffDirection: diffAbnormalSessions
        ? diffAbnormalSessions > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: diffAbnormalSessions
        ? diffAbnormalSessions > 0
          ? 'red300'
          : 'green300'
        : null,
    },
    {
      type: ReleaseComparisonChartType.ERRORED_SESSIONS,
      thisRelease: defined(releaseErroredSessions)
        ? displaySessionStatusPercent(releaseErroredSessions)
        : null,
      allReleases: defined(allErroredSessions)
        ? displaySessionStatusPercent(allErroredSessions)
        : null,
      diff: defined(diffErroredSessions)
        ? displaySessionStatusPercent(diffErroredSessions)
        : null,
      diffDirection: diffErroredSessions
        ? diffErroredSessions > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: diffErroredSessions
        ? diffErroredSessions > 0
          ? 'red300'
          : 'green300'
        : null,
    },
    {
      type: ReleaseComparisonChartType.CRASHED_SESSIONS,
      thisRelease: defined(releaseCrashedSessions)
        ? displaySessionStatusPercent(releaseCrashedSessions)
        : null,
      allReleases: defined(allCrashedSessions)
        ? displaySessionStatusPercent(allCrashedSessions)
        : null,
      diff: defined(diffCrashedSessions)
        ? displaySessionStatusPercent(diffCrashedSessions)
        : null,
      diffDirection: diffCrashedSessions
        ? diffCrashedSessions > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: diffCrashedSessions
        ? diffCrashedSessions > 0
          ? 'red300'
          : 'green300'
        : null,
    },
    {
      type: ReleaseComparisonChartType.CRASH_FREE_USERS,
      thisRelease: defined(releaseCrashFreeUsers)
        ? displayCrashFreePercent(releaseCrashFreeUsers)
        : null,
      allReleases: defined(allCrashFreeUsers)
        ? displayCrashFreePercent(allCrashFreeUsers)
        : null,
      diff: defined(diffCrashFreeUsers)
        ? displayCrashFreeDiff(diffCrashFreeUsers, releaseCrashFreeUsers)
        : null,
      diffDirection: diffCrashFreeUsers ? (diffCrashFreeUsers > 0 ? 'up' : 'down') : null,
      diffColor: diffCrashFreeUsers
        ? diffCrashFreeUsers > 0
          ? 'green300'
          : 'red300'
        : null,
    },
    {
      type: ReleaseComparisonChartType.HEALTHY_USERS,
      thisRelease: defined(releaseHealthyUsers)
        ? displaySessionStatusPercent(releaseHealthyUsers)
        : null,
      allReleases: defined(allHealthyUsers)
        ? displaySessionStatusPercent(allHealthyUsers)
        : null,
      diff: defined(diffHealthyUsers)
        ? displaySessionStatusPercent(diffHealthyUsers)
        : null,
      diffDirection: diffHealthyUsers ? (diffHealthyUsers > 0 ? 'up' : 'down') : null,
      diffColor: diffHealthyUsers ? (diffHealthyUsers > 0 ? 'green300' : 'red300') : null,
    },
    {
      type: ReleaseComparisonChartType.ABNORMAL_USERS,
      thisRelease: defined(releaseAbnormalUsers)
        ? displaySessionStatusPercent(releaseAbnormalUsers)
        : null,
      allReleases: defined(allAbnormalUsers)
        ? displaySessionStatusPercent(allAbnormalUsers)
        : null,
      diff: defined(diffAbnormalUsers)
        ? displaySessionStatusPercent(diffAbnormalUsers)
        : null,
      diffDirection: diffAbnormalUsers ? (diffAbnormalUsers > 0 ? 'up' : 'down') : null,
      diffColor: diffAbnormalUsers
        ? diffAbnormalUsers > 0
          ? 'red300'
          : 'green300'
        : null,
    },
    {
      type: ReleaseComparisonChartType.ERRORED_USERS,
      thisRelease: defined(releaseErroredUsers)
        ? displaySessionStatusPercent(releaseErroredUsers)
        : null,
      allReleases: defined(allErroredUsers)
        ? displaySessionStatusPercent(allErroredUsers)
        : null,
      diff: defined(diffErroredUsers)
        ? displaySessionStatusPercent(diffErroredUsers)
        : null,
      diffDirection: diffErroredUsers ? (diffErroredUsers > 0 ? 'up' : 'down') : null,
      diffColor: diffErroredUsers ? (diffErroredUsers > 0 ? 'red300' : 'green300') : null,
    },
    {
      type: ReleaseComparisonChartType.CRASHED_USERS,
      thisRelease: defined(releaseCrashedUsers)
        ? displaySessionStatusPercent(releaseCrashedUsers)
        : null,
      allReleases: defined(allCrashedUsers)
        ? displaySessionStatusPercent(allCrashedUsers)
        : null,
      diff: defined(diffCrashedUsers)
        ? displaySessionStatusPercent(diffCrashedUsers)
        : null,
      diffDirection: diffCrashedUsers ? (diffCrashedUsers > 0 ? 'up' : 'down') : null,
      diffColor: diffCrashedUsers ? (diffCrashedUsers > 0 ? 'red300' : 'green300') : null,
    },
    {
      type: ReleaseComparisonChartType.FAILURE_RATE,
      thisRelease: eventsTotals?.releaseFailureRate
        ? formatPercentage(eventsTotals?.releaseFailureRate)
        : null,
      allReleases: eventsTotals?.allFailureRate
        ? formatPercentage(eventsTotals?.allFailureRate)
        : null,
      diff: diffFailure ? formatPercentage(Math.abs(diffFailure)) : null,
      diffDirection: diffFailure ? (diffFailure > 0 ? 'up' : 'down') : null,
      diffColor: diffFailure ? (diffFailure > 0 ? 'red300' : 'green300') : null,
    },
    {
      type: ReleaseComparisonChartType.SESSION_COUNT,
      thisRelease: defined(releaseSessionsCount) ? (
        <Count value={releaseSessionsCount} />
      ) : null,
      allReleases: defined(allSessionsCount) ? <Count value={allSessionsCount} /> : null,
      diff: null,
      diffDirection: null,
      diffColor: null,
    },
    {
      type: ReleaseComparisonChartType.USER_COUNT,
      thisRelease: defined(releaseUsersCount) ? (
        <Count value={releaseUsersCount} />
      ) : null,
      allReleases: defined(allUsersCount) ? <Count value={allUsersCount} /> : null,
      diff: null,
      diffDirection: null,
      diffColor: null,
    },
    {
      type: ReleaseComparisonChartType.ERROR_COUNT,
      thisRelease: defined(eventsTotals?.releaseErrorCount) ? (
        <Count value={eventsTotals?.releaseErrorCount!} />
      ) : null,
      allReleases: defined(eventsTotals?.allErrorCount) ? (
        <Count value={eventsTotals?.allErrorCount!} />
      ) : null,
      diff: null,
      diffDirection: null,
      diffColor: null,
    },
    {
      type: ReleaseComparisonChartType.TRANSACTION_COUNT,
      thisRelease: defined(eventsTotals?.releaseTransactionCount) ? (
        <Count value={eventsTotals?.releaseTransactionCount!} />
      ) : null,
      allReleases: defined(eventsTotals?.allTransactionCount) ? (
        <Count value={eventsTotals?.allTransactionCount!} />
      ) : null,
      diff: null,
      diffDirection: null,
      diffColor: null,
    },
  ];

  function getSeries(chartType: ReleaseComparisonChartType) {
    if (!releaseSessions) {
      return {};
    }

    const markLines = generateReleaseMarkLines(release, project.slug, theme);

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
              chartData: initSessionsBreakdownChartData(),
            })
          ),
          markLines,
        };
      case ReleaseComparisonChartType.USER_COUNT:
        return {
          series: Object.values(
            fillChartDataFromSessionsResponse({
              response: releaseSessions,
              field: SessionField.USERS,
              groupBy: 'session.status',
              chartData: initSessionsBreakdownChartData(),
            })
          ),
          markLines,
        };
      default:
        return {};
    }
  }

  function handleChartChange(chartType: ReleaseComparisonChartType) {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        chart: chartType,
      },
    });
  }

  const {series, previousSeries, markLines} = getSeries(activeChart);
  const chart = charts.find(ch => ch.type === activeChart);

  if (errored || !chart) {
    return (
      <Panel>
        <ErrorPanel>
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      </Panel>
    );
  }

  const chartDiff = chart.diff ? (
    <Change color={defined(chart.diffColor) ? chart.diffColor : undefined}>
      {chart.diff}{' '}
      {defined(chart.diffDirection) && (
        <IconArrow direction={chart.diffDirection} size="xs" />
      )}
    </Change>
  ) : null;

  return (
    <Fragment>
      <ChartPanel>
        <ChartContainer>
          {[
            ReleaseComparisonChartType.ERROR_COUNT,
            ReleaseComparisonChartType.TRANSACTION_COUNT,
            ReleaseComparisonChartType.FAILURE_RATE,
          ].includes(activeChart) ? (
            <ReleaseEventsChart
              version={release.version}
              chartType={activeChart}
              period={period ?? undefined}
              start={start}
              end={end}
              utc={utc === 'true'}
              value={chart.thisRelease}
              diff={chartDiff}
            />
          ) : (
            <ReleaseSessionsChart
              series={[...(series ?? []), ...(markLines ?? [])]}
              previousSeries={previousSeries ?? []}
              chartType={activeChart}
              platform={platform}
              period={period ?? undefined}
              start={start}
              end={end}
              utc={utc === 'true'}
              value={chart.thisRelease}
              diff={chartDiff}
              loading={loading}
              reloading={reloading}
            />
          )}
        </ChartContainer>
      </ChartPanel>
      <ChartTable
        headers={[
          <Cell key="stability" align="left">
            {t('Stability')}
          </Cell>,
          <Cell key="releases" align="right">
            {t('All Releases')}
          </Cell>,
          <Cell key="release" align="right">
            {t('This Release')}
          </Cell>,
          <Cell key="change" align="right">
            {t('Change')}
          </Cell>,
        ]}
      >
        {charts.map(
          ({type, thisRelease, allReleases, diff, diffDirection, diffColor}) => {
            return (
              <Fragment key={type}>
                <Cell align="left">
                  <ChartToggle htmlFor={type}>
                    <Radio
                      id={type}
                      disabled={false}
                      checked={type === activeChart}
                      onChange={() => handleChartChange(type)}
                    />
                    {releaseComparisonChartLabels[type]}
                  </ChartToggle>
                </Cell>
                <Cell align="right">
                  {loading ? <Placeholder height="20px" /> : allReleases}
                </Cell>
                <Cell align="right">
                  {loading ? <Placeholder height="20px" /> : thisRelease}
                </Cell>
                <Cell align="right">
                  {loading ? (
                    <Placeholder height="20px" />
                  ) : defined(diff) ? (
                    <Change color={defined(diffColor) ? diffColor : undefined}>
                      {defined(diffDirection) && (
                        <IconArrow direction={diffDirection} size="xs" />
                      )}{' '}
                      {diff}
                    </Change>
                  ) : (
                    <NotAvailable />
                  )}
                </Cell>
              </Fragment>
            );
          }
        )}
      </ChartTable>
    </Fragment>
  );
}

const ChartPanel = styled(Panel)`
  margin-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom: none;
  border-bottom-right-radius: 0;
`;

const ChartTable = styled(PanelTable)`
  border-top-left-radius: 0;
  border-top-right-radius: 0;

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: min-content 1fr 1fr 1fr;
  }
`;

const Cell = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
  ${overflowEllipsis}
`;

const ChartToggle = styled('label')`
  display: flex;
  align-items: center;
  font-weight: 400;
  margin-bottom: 0;
  input {
    flex-shrink: 0;
    margin-right: ${space(1)} !important;
    &:hover {
      cursor: pointer;
    }
  }
  &:hover {
    cursor: pointer;
  }
`;

const Change = styled('div')<{color?: Color}>`
  font-size: ${p => p.theme.fontSizeLarge};
  ${p => p.color && `color: ${p.theme[p.color]}`}
`;

export default withTheme(ReleaseComparisonChart);
