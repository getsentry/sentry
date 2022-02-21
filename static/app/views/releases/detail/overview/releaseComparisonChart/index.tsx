import {Fragment, useEffect, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {ChartContainer} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import Duration from 'sentry/components/duration';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import NotAvailable from 'sentry/components/notAvailable';
import {Panel, PanelTable} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {PlatformKey} from 'sentry/data/platformCategories';
import {IconArrow, IconChevron, IconList, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {
  Organization,
  ReleaseComparisonChartType,
  ReleaseProject,
  ReleaseWithHealth,
  SessionApiResponse,
  SessionField,
  SessionStatus,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {
  getCount,
  getCrashFreeRate,
  getSeriesAverage,
  getSessionStatusRate,
} from 'sentry/utils/sessions';
import {Color} from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {
  displaySessionStatusPercent,
  getReleaseBounds,
  getReleaseHandledIssuesUrl,
  getReleaseParams,
  getReleaseUnhandledIssuesUrl,
  roundDuration,
} from 'sentry/views/releases/utils';

import ReleaseComparisonChartRow from './releaseComparisonChartRow';
import ReleaseEventsChart from './releaseEventsChart';
import ReleaseSessionsChart from './releaseSessionsChart';

export type ReleaseComparisonRow = {
  allReleases: React.ReactNode;
  diff: React.ReactNode;
  diffColor: Color | null;
  diffDirection: 'up' | 'down' | null;
  drilldown: React.ReactNode;
  role: 'parent' | 'children' | 'default';
  thisRelease: React.ReactNode;
  type: ReleaseComparisonChartType;
};

type Props = {
  allSessions: SessionApiResponse | null;
  api: Client;
  errored: boolean;
  hasHealthData: boolean;
  loading: boolean;
  location: Location;
  organization: Organization;
  platform: PlatformKey;
  project: ReleaseProject;
  release: ReleaseWithHealth;
  releaseSessions: SessionApiResponse | null;
  reloading: boolean;
};

type EventsTotals = {
  allErrorCount: number;
  allFailureRate: number;
  allTransactionCount: number;
  releaseErrorCount: number;
  releaseFailureRate: number;
  releaseTransactionCount: number;
} | null;

type IssuesTotals = {
  handled: number;
  unhandled: number;
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
  api,
  organization,
  hasHealthData,
}: Props) {
  const [issuesTotals, setIssuesTotals] = useState<IssuesTotals>(null);
  const [eventsTotals, setEventsTotals] = useState<EventsTotals>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [isOtherExpanded, setIsOtherExpanded] = useState(false);
  const charts: ReleaseComparisonRow[] = [];
  const additionalCharts: ReleaseComparisonRow[] = [];
  const hasDiscover =
    organization.features.includes('discover-basic') ||
    organization.features.includes('performance-view');
  const hasPerformance = organization.features.includes('performance-view');
  const {
    statsPeriod: period,
    start,
    end,
    utc,
  } = useMemo(
    () =>
      // Memoizing this so that it does not calculate different `end` for releases without events+sessions each rerender
      getReleaseParams({
        location,
        releaseBounds: getReleaseBounds(release),
      }),
    [release, location]
  );

  useEffect(() => {
    if (hasDiscover || hasPerformance) {
      fetchEventsTotals();
      fetchIssuesTotals();
    }
  }, [
    period,
    start,
    end,
    organization.slug,
    location.query.project,
    location.query.environment?.toString(),
    release.version,
  ]);

  useEffect(() => {
    const chartInUrl = decodeScalar(location.query.chart) as ReleaseComparisonChartType;
    if (
      [
        ReleaseComparisonChartType.HEALTHY_SESSIONS,
        ReleaseComparisonChartType.ABNORMAL_SESSIONS,
        ReleaseComparisonChartType.ERRORED_SESSIONS,
        ReleaseComparisonChartType.CRASHED_SESSIONS,
      ].includes(chartInUrl)
    ) {
      setExpanded(new Set(expanded.add(ReleaseComparisonChartType.CRASH_FREE_SESSIONS)));
    }

    if (
      [
        ReleaseComparisonChartType.HEALTHY_USERS,
        ReleaseComparisonChartType.ABNORMAL_USERS,
        ReleaseComparisonChartType.ERRORED_USERS,
        ReleaseComparisonChartType.CRASHED_USERS,
      ].includes(chartInUrl)
    ) {
      setExpanded(new Set(expanded.add(ReleaseComparisonChartType.CRASH_FREE_USERS)));
    }

    if (
      [
        ReleaseComparisonChartType.SESSION_COUNT,
        ReleaseComparisonChartType.USER_COUNT,
        ReleaseComparisonChartType.ERROR_COUNT,
        ReleaseComparisonChartType.TRANSACTION_COUNT,
      ].includes(chartInUrl)
    ) {
      setIsOtherExpanded(true);
    }
  }, [location.query.chart]);

  async function fetchEventsTotals() {
    const url = `/organizations/${organization.slug}/eventsv2/`;
    const commonQuery = {
      environment: decodeList(location.query.environment),
      project: decodeList(location.query.project),
      start,
      end,
      ...(period ? {statsPeriod: period} : {}),
    };

    if (eventsTotals === null) {
      setEventsLoading(true);
    }

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
            query: new MutableSearch([
              'event.type:transaction',
              `release:${release.version}`,
            ]).formatString(),
            ...commonQuery,
          },
        }),
        api.requestPromise(url, {
          query: {
            field: ['failure_rate()', 'count()'],
            query: new MutableSearch(['event.type:transaction']).formatString(),
            ...commonQuery,
          },
        }),
        api.requestPromise(url, {
          query: {
            field: ['count()'],
            query: new MutableSearch([
              'event.type:error',
              `release:${release.version}`,
            ]).formatString(),
            ...commonQuery,
          },
        }),
        api.requestPromise(url, {
          query: {
            field: ['count()'],
            query: new MutableSearch(['event.type:error']).formatString(),
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
      setEventsLoading(false);
    } catch (err) {
      setEventsTotals(null);
      setEventsLoading(false);
      Sentry.captureException(err);
    }
  }

  async function fetchIssuesTotals() {
    const UNHANDLED_QUERY = `release:"${release.version}" error.handled:0`;
    const HANDLED_QUERY = `release:"${release.version}" error.handled:1`;

    try {
      const response = await api.requestPromise(
        `/organizations/${organization.slug}/issues-count/`,
        {
          query: {
            project: project.id,
            environment: decodeList(location.query.environment),
            start,
            end,
            ...(period ? {statsPeriod: period} : {}),
            query: [UNHANDLED_QUERY, HANDLED_QUERY],
          },
        }
      );

      setIssuesTotals({
        handled: response[HANDLED_QUERY] ?? 0,
        unhandled: response[UNHANDLED_QUERY] ?? 0,
      });
    } catch (err) {
      setIssuesTotals(null);
      Sentry.captureException(err);
    }
  }

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

  const sessionDurationTotal = roundDuration(
    (getSeriesAverage(releaseSessions?.groups, SessionField.DURATION) ?? 0) / 1000
  );
  const allSessionDurationTotal = roundDuration(
    (getSeriesAverage(allSessions?.groups, SessionField.DURATION) ?? 0) / 1000
  );

  const diffFailure =
    eventsTotals?.releaseFailureRate && eventsTotals?.allFailureRate
      ? eventsTotals.releaseFailureRate - eventsTotals.allFailureRate
      : null;

  if (hasHealthData) {
    charts.push({
      type: ReleaseComparisonChartType.CRASH_FREE_SESSIONS,
      role: 'parent',
      drilldown: null,
      thisRelease: defined(releaseCrashFreeSessions)
        ? displaySessionStatusPercent(releaseCrashFreeSessions)
        : null,
      allReleases: defined(allCrashFreeSessions)
        ? displaySessionStatusPercent(allCrashFreeSessions)
        : null,
      diff: defined(diffCrashFreeSessions)
        ? displaySessionStatusPercent(diffCrashFreeSessions)
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
    });
    if (expanded.has(ReleaseComparisonChartType.CRASH_FREE_SESSIONS)) {
      charts.push(
        {
          type: ReleaseComparisonChartType.HEALTHY_SESSIONS,
          role: 'children',
          drilldown: null,
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
          role: 'children',
          drilldown: null,
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
          role: 'children',
          drilldown: defined(issuesTotals?.handled) ? (
            <Tooltip title={t('Open in Issues')}>
              <GlobalSelectionLink
                to={getReleaseHandledIssuesUrl(
                  organization.slug,
                  project.id,
                  release.version,
                  {start, end, period: period ?? undefined}
                )}
              >
                {tct('([count] handled [issues])', {
                  count: issuesTotals?.handled
                    ? issuesTotals.handled >= 100
                      ? '99+'
                      : issuesTotals.handled
                    : 0,
                  issues: tn('issue', 'issues', issuesTotals?.handled),
                })}
              </GlobalSelectionLink>
            </Tooltip>
          ) : null,
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
          role: 'default',
          drilldown: defined(issuesTotals?.unhandled) ? (
            <Tooltip title={t('Open in Issues')}>
              <GlobalSelectionLink
                to={getReleaseUnhandledIssuesUrl(
                  organization.slug,
                  project.id,
                  release.version,
                  {start, end, period: period ?? undefined}
                )}
              >
                {tct('([count] unhandled [issues])', {
                  count: issuesTotals?.unhandled
                    ? issuesTotals.unhandled >= 100
                      ? '99+'
                      : issuesTotals.unhandled
                    : 0,
                  issues: tn('issue', 'issues', issuesTotals?.unhandled),
                })}
              </GlobalSelectionLink>
            </Tooltip>
          ) : null,
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
        }
      );
    }
  }

  const hasUsers = !!getCount(releaseSessions?.groups, SessionField.USERS);
  if (hasHealthData && (hasUsers || loading)) {
    charts.push({
      type: ReleaseComparisonChartType.CRASH_FREE_USERS,
      role: 'parent',
      drilldown: null,
      thisRelease: defined(releaseCrashFreeUsers)
        ? displaySessionStatusPercent(releaseCrashFreeUsers)
        : null,
      allReleases: defined(allCrashFreeUsers)
        ? displaySessionStatusPercent(allCrashFreeUsers)
        : null,
      diff: defined(diffCrashFreeUsers)
        ? displaySessionStatusPercent(diffCrashFreeUsers)
        : null,
      diffDirection: diffCrashFreeUsers ? (diffCrashFreeUsers > 0 ? 'up' : 'down') : null,
      diffColor: diffCrashFreeUsers
        ? diffCrashFreeUsers > 0
          ? 'green300'
          : 'red300'
        : null,
    });
    if (expanded.has(ReleaseComparisonChartType.CRASH_FREE_USERS)) {
      charts.push(
        {
          type: ReleaseComparisonChartType.HEALTHY_USERS,
          role: 'children',
          drilldown: null,
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
          diffColor: diffHealthyUsers
            ? diffHealthyUsers > 0
              ? 'green300'
              : 'red300'
            : null,
        },
        {
          type: ReleaseComparisonChartType.ABNORMAL_USERS,
          role: 'children',
          drilldown: null,
          thisRelease: defined(releaseAbnormalUsers)
            ? displaySessionStatusPercent(releaseAbnormalUsers)
            : null,
          allReleases: defined(allAbnormalUsers)
            ? displaySessionStatusPercent(allAbnormalUsers)
            : null,
          diff: defined(diffAbnormalUsers)
            ? displaySessionStatusPercent(diffAbnormalUsers)
            : null,
          diffDirection: diffAbnormalUsers
            ? diffAbnormalUsers > 0
              ? 'up'
              : 'down'
            : null,
          diffColor: diffAbnormalUsers
            ? diffAbnormalUsers > 0
              ? 'red300'
              : 'green300'
            : null,
        },
        {
          type: ReleaseComparisonChartType.ERRORED_USERS,
          role: 'children',
          drilldown: null,
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
          diffColor: diffErroredUsers
            ? diffErroredUsers > 0
              ? 'red300'
              : 'green300'
            : null,
        },
        {
          type: ReleaseComparisonChartType.CRASHED_USERS,
          role: 'default',
          drilldown: null,
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
          diffColor: diffCrashedUsers
            ? diffCrashedUsers > 0
              ? 'red300'
              : 'green300'
            : null,
        }
      );
    }
  }

  if (hasPerformance) {
    charts.push({
      type: ReleaseComparisonChartType.FAILURE_RATE,
      role: 'default',
      drilldown: null,
      thisRelease: eventsTotals?.releaseFailureRate
        ? formatPercentage(eventsTotals?.releaseFailureRate)
        : null,
      allReleases: eventsTotals?.allFailureRate
        ? formatPercentage(eventsTotals?.allFailureRate)
        : null,
      diff: diffFailure ? formatPercentage(Math.abs(diffFailure)) : null,
      diffDirection: diffFailure ? (diffFailure > 0 ? 'up' : 'down') : null,
      diffColor: diffFailure ? (diffFailure > 0 ? 'red300' : 'green300') : null,
    });
  }

  if (hasHealthData) {
    charts.push({
      type: ReleaseComparisonChartType.SESSION_DURATION,
      role: 'default',
      drilldown: null,
      thisRelease: defined(sessionDurationTotal) ? (
        <Duration seconds={sessionDurationTotal} abbreviation />
      ) : null,
      allReleases: defined(allSessionDurationTotal) ? (
        <Duration seconds={allSessionDurationTotal} abbreviation />
      ) : null,
      diff: null,
      diffDirection: null,
      diffColor: null,
    });
    additionalCharts.push({
      type: ReleaseComparisonChartType.SESSION_COUNT,
      role: 'default',
      drilldown: null,
      thisRelease: defined(releaseSessionsCount) ? (
        <Count value={releaseSessionsCount} />
      ) : null,
      allReleases: defined(allSessionsCount) ? <Count value={allSessionsCount} /> : null,
      diff: null,
      diffDirection: null,
      diffColor: null,
    });
    if (hasUsers || loading) {
      additionalCharts.push({
        type: ReleaseComparisonChartType.USER_COUNT,
        role: 'default',
        drilldown: null,
        thisRelease: defined(releaseUsersCount) ? (
          <Count value={releaseUsersCount} />
        ) : null,
        allReleases: defined(allUsersCount) ? <Count value={allUsersCount} /> : null,
        diff: null,
        diffDirection: null,
        diffColor: null,
      });
    }
  }

  if (hasDiscover) {
    additionalCharts.push({
      type: ReleaseComparisonChartType.ERROR_COUNT,
      role: 'default',
      drilldown: null,
      thisRelease: defined(eventsTotals?.releaseErrorCount) ? (
        <Count value={eventsTotals?.releaseErrorCount!} />
      ) : null,
      allReleases: defined(eventsTotals?.allErrorCount) ? (
        <Count value={eventsTotals?.allErrorCount!} />
      ) : null,
      diff: null,
      diffDirection: null,
      diffColor: null,
    });
  }

  if (hasPerformance) {
    additionalCharts.push({
      type: ReleaseComparisonChartType.TRANSACTION_COUNT,
      role: 'default',
      drilldown: null,
      thisRelease: defined(eventsTotals?.releaseTransactionCount) ? (
        <Count value={eventsTotals?.releaseTransactionCount!} />
      ) : null,
      allReleases: defined(eventsTotals?.allTransactionCount) ? (
        <Count value={eventsTotals?.allTransactionCount!} />
      ) : null,
      diff: null,
      diffDirection: null,
      diffColor: null,
    });
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

  function handleExpanderToggle(chartType: ReleaseComparisonChartType) {
    if (expanded.has(chartType)) {
      expanded.delete(chartType);
      setExpanded(new Set(expanded));
    } else {
      setExpanded(new Set(expanded.add(chartType)));
    }
  }

  function getTableHeaders(withExpanders: boolean) {
    const headers = [
      <DescriptionCell key="description">{t('Description')}</DescriptionCell>,
      <Cell key="releases">{t('All Releases')}</Cell>,
      <Cell key="release">{t('This Release')}</Cell>,
      <Cell key="change">{t('Change')}</Cell>,
    ];
    if (withExpanders) {
      headers.push(<Cell key="expanders" />);
    }
    return headers;
  }

  function getChartDiff(
    diff: ReleaseComparisonRow['diff'],
    diffColor: ReleaseComparisonRow['diffColor'],
    diffDirection: ReleaseComparisonRow['diffDirection']
  ) {
    return diff ? (
      <Change color={defined(diffColor) ? diffColor : undefined}>
        {diff}{' '}
        {defined(diffDirection) ? (
          <IconArrow direction={diffDirection} size="xs" />
        ) : diff === '0%' ? null : (
          <StyledNotAvailable />
        )}
      </Change>
    ) : null;
  }

  // if there are no sessions, we do not need to do row toggling because there won't be as many rows
  if (!hasHealthData) {
    charts.push(...additionalCharts);
    additionalCharts.splice(0, additionalCharts.length);
  }

  let activeChart = decodeScalar(
    location.query.chart,
    hasHealthData
      ? ReleaseComparisonChartType.CRASH_FREE_SESSIONS
      : hasPerformance
      ? ReleaseComparisonChartType.FAILURE_RATE
      : ReleaseComparisonChartType.ERROR_COUNT
  ) as ReleaseComparisonChartType;

  let chart = [...charts, ...additionalCharts].find(ch => ch.type === activeChart);

  if (!chart) {
    chart = charts[0];
    activeChart = charts[0].type;
  }

  const showPlaceholders = loading || eventsLoading;
  const withExpanders = hasHealthData || additionalCharts.length > 0;

  if (errored || !chart) {
    return (
      <Panel>
        <ErrorPanel>
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      </Panel>
    );
  }

  const titleChartDiff =
    chart.diff !== '0%' && chart.thisRelease !== '0%'
      ? getChartDiff(chart.diff, chart.diffColor, chart.diffDirection)
      : null;

  function renderChartRow({
    diff,
    diffColor,
    diffDirection,
    ...rest
  }: ReleaseComparisonRow) {
    return (
      <ReleaseComparisonChartRow
        {...rest}
        key={rest.type}
        diff={diff}
        showPlaceholders={showPlaceholders}
        activeChart={activeChart}
        onChartChange={handleChartChange}
        chartDiff={getChartDiff(diff, diffColor, diffDirection)}
        onExpanderToggle={handleExpanderToggle}
        expanded={expanded.has(rest.type)}
        withExpanders={withExpanders}
      />
    );
  }

  return (
    <Fragment>
      <ChartPanel>
        <ChartContainer>
          {[
            ReleaseComparisonChartType.ERROR_COUNT,
            ReleaseComparisonChartType.TRANSACTION_COUNT,
            ReleaseComparisonChartType.FAILURE_RATE,
          ].includes(activeChart)
            ? getDynamicText({
                value: (
                  <ReleaseEventsChart
                    release={release}
                    project={project}
                    chartType={activeChart}
                    period={period ?? undefined}
                    start={start}
                    end={end}
                    utc={utc === 'true'}
                    value={chart.thisRelease}
                    diff={titleChartDiff}
                  />
                ),
                fixed: 'Events Chart',
              })
            : getDynamicText({
                value: (
                  <ReleaseSessionsChart
                    releaseSessions={releaseSessions}
                    allSessions={allSessions}
                    release={release}
                    project={project}
                    chartType={activeChart}
                    platform={platform}
                    period={period ?? undefined}
                    start={start}
                    end={end}
                    utc={utc === 'true'}
                    value={chart.thisRelease}
                    diff={titleChartDiff}
                    loading={loading}
                    reloading={reloading}
                  />
                ),
                fixed: 'Sessions Chart',
              })}
        </ChartContainer>
      </ChartPanel>
      <ChartTable
        headers={getTableHeaders(withExpanders)}
        data-test-id="release-comparison-table"
        withExpanders={withExpanders}
      >
        {charts.map(chartRow => renderChartRow(chartRow))}
        {isOtherExpanded && additionalCharts.map(chartRow => renderChartRow(chartRow))}
        {additionalCharts.length > 0 && (
          <ShowMoreWrapper onClick={() => setIsOtherExpanded(!isOtherExpanded)}>
            <ShowMoreTitle>
              <IconList size="xs" />
              {isOtherExpanded
                ? tn('Hide %s Other', 'Hide %s Others', additionalCharts.length)
                : tn('Show %s Other', 'Show %s Others', additionalCharts.length)}
            </ShowMoreTitle>
            <ShowMoreButton>
              <Button
                borderless
                size="zero"
                icon={<IconChevron direction={isOtherExpanded ? 'up' : 'down'} />}
                aria-label={t('Toggle additional charts')}
              />
            </ShowMoreButton>
          </ShowMoreWrapper>
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

const Cell = styled('div')`
  text-align: right;
  ${overflowEllipsis}
`;

const DescriptionCell = styled(Cell)`
  text-align: left;
  overflow: visible;
`;

const Change = styled('div')<{color?: Color}>`
  font-size: ${p => p.theme.fontSizeLarge};
  ${p => p.color && `color: ${p.theme[p.color]}`}
`;

const ChartTable = styled(PanelTable)<{withExpanders: boolean}>`
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  grid-template-columns: minmax(400px, auto) repeat(3, minmax(min-content, 1fr)) ${p =>
      p.withExpanders ? '75px' : ''};

  > * {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(4, minmax(min-content, 1fr)) ${p =>
        p.withExpanders ? '75px' : ''};
  }
`;

const StyledNotAvailable = styled(NotAvailable)`
  display: inline-block;
`;

const ShowMoreWrapper = styled('div')`
  display: contents;
  &:hover {
    cursor: pointer;
  }
  > * {
    padding: ${space(1)} ${space(2)};
  }
`;

const ShowMoreTitle = styled('div')`
  color: ${p => p.theme.gray300};
  display: inline-grid;
  grid-template-columns: auto auto;
  gap: 10px;
  align-items: center;
  justify-content: flex-start;
  svg {
    margin-left: ${space(0.25)};
  }
`;

const ShowMoreButton = styled('div')`
  grid-column: 2 / -1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
`;

export default ReleaseComparisonChart;
