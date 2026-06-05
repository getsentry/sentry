import React, {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {Client} from 'sentry/api';
import {ErrorPanel} from 'sentry/components/charts/errorPanel';
import {ChartContainer} from 'sentry/components/charts/styles';
import {Count} from 'sentry/components/count';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {NotAvailable} from 'sentry/components/notAvailable';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {Panel} from 'sentry/components/panels/panel';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconArrow, IconChevron, IconList, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {
  SessionFieldWithOperation,
  SessionStatus,
  type SessionApiResponse,
} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import {
  ReleaseComparisonChartType,
  type ReleaseProject,
  type ReleaseWithHealth,
} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getDynamicText} from 'sentry/utils/getDynamicText';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {decodeList, decodeScalar} from 'sentry/utils/queryString';
import {getCount, getCrashFreeRate, getSessionStatusRate} from 'sentry/utils/sessions';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  displaySessionStatusPercent,
  getReleaseBounds,
  getReleaseHandledIssuesUrl,
  getReleaseParams,
  getReleaseUnhandledIssuesUrl,
} from 'sentry/views/explore/releases/utils';

import {ReleaseComparisonChartRow} from './releaseComparisonChartRow';
import {ReleaseEventsChart} from './releaseEventsChart';
import ReleaseSessionsChart from './releaseSessionsChart';

export type ReleaseComparisonRow = {
  allReleases: React.ReactNode;
  diff: React.ReactNode;
  diffColor: string | null;
  diffDirection: 'up' | 'down' | null;
  drilldown: React.ReactNode;
  role: 'parent' | 'children' | 'default';
  thisRelease: React.ReactNode;
  type: ReleaseComparisonChartType;
  tooltip?: React.ReactNode;
};

type Props = {
  allSessions: SessionApiResponse | null;
  api: Client;
  errored: boolean;
  hasHealthData: boolean;
  loading: boolean;
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

export function ReleaseComparisonChart({
  release,
  project,
  releaseSessions,
  allSessions,
  platform,
  loading,
  reloading,
  errored,
  api,
  hasHealthData,
}: Props) {
  const theme = useTheme();
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
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
    const chartInUrl = decodeScalar(location.query.chart) as ReleaseComparisonChartType;
    if (
      [
        ReleaseComparisonChartType.HEALTHY_SESSIONS,
        ReleaseComparisonChartType.ABNORMAL_SESSIONS,
        ReleaseComparisonChartType.ERRORED_SESSIONS,
        ReleaseComparisonChartType.CRASHED_SESSIONS,
        ReleaseComparisonChartType.UNHANDLED_SESSIONS,
      ].includes(chartInUrl)
    ) {
      setExpanded(e => new Set(e.add(ReleaseComparisonChartType.CRASH_FREE_SESSIONS)));
    }

    if (
      [
        ReleaseComparisonChartType.HEALTHY_USERS,
        ReleaseComparisonChartType.ABNORMAL_USERS,
        ReleaseComparisonChartType.ERRORED_USERS,
        ReleaseComparisonChartType.CRASHED_USERS,
        ReleaseComparisonChartType.UNHANDLED_USERS,
      ].includes(chartInUrl)
    ) {
      setExpanded(e => new Set(e.add(ReleaseComparisonChartType.CRASH_FREE_USERS)));
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

  const fetchEventsTotals = useCallback(async () => {
    const url = `/organizations/${organization.slug}/events/`;
    const commonQuery = {
      environment: decodeList(location.query.environment),
      project: decodeList(location.query.project),
      start,
      end,
      ...(period ? {statsPeriod: period} : {}),
    };

    setEventsLoading(true);

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
            dataset: DiscoverDatasets.METRICS_ENHANCED,
            ...commonQuery,
          },
        }),
        api.requestPromise(url, {
          query: {
            field: ['failure_rate()', 'count()'],
            query: new MutableSearch(['event.type:transaction']).formatString(),
            dataset: DiscoverDatasets.METRICS_ENHANCED,
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
        allErrorCount: allErrorTotals.data[0]['count()'],
        releaseErrorCount: releaseErrorTotals.data[0]['count()'],
        allTransactionCount: allTransactionTotals.data[0]['count()'],
        releaseTransactionCount: releaseTransactionTotals.data[0]['count()'],
        releaseFailureRate: releaseTransactionTotals.data[0]['failure_rate()'],
        allFailureRate: allTransactionTotals.data[0]['failure_rate()'],
      });
      setEventsLoading(false);
    } catch (err) {
      setEventsTotals(null);
      setEventsLoading(false);
      Sentry.captureException(err);
    }
  }, [
    api,
    end,
    location.query.environment,
    location.query.project,
    organization.slug,
    period,
    release.version,
    start,
  ]);

  const fetchIssuesTotals = useCallback(async () => {
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
  }, [
    api,
    end,
    location.query.environment,
    organization.slug,
    period,
    project.id,
    release.version,
    start,
  ]);

  useEffect(() => {
    if (hasDiscover || hasPerformance) {
      fetchEventsTotals();
      fetchIssuesTotals();
    }
  }, [fetchEventsTotals, fetchIssuesTotals, hasDiscover, hasPerformance]);

  const releaseCrashFreeSessions = getCrashFreeRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.SESSIONS
  );
  const allCrashFreeSessions = getCrashFreeRate(
    allSessions?.groups,
    SessionFieldWithOperation.SESSIONS
  );
  const diffCrashFreeSessions =
    releaseCrashFreeSessions != null && allCrashFreeSessions != null
      ? releaseCrashFreeSessions - allCrashFreeSessions
      : null;

  const releaseHealthySessions = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.HEALTHY
  );
  const allHealthySessions = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.HEALTHY
  );
  const diffHealthySessions =
    releaseHealthySessions != null && allHealthySessions != null
      ? releaseHealthySessions - allHealthySessions
      : null;

  const releaseAbnormalSessions = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.ABNORMAL
  );
  const allAbnormalSessions = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.ABNORMAL
  );
  const diffAbnormalSessions =
    releaseAbnormalSessions != null && allAbnormalSessions != null
      ? releaseAbnormalSessions - allAbnormalSessions
      : null;

  const releaseErroredSessions = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.ERRORED
  );
  const allErroredSessions = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.ERRORED
  );
  const diffErroredSessions =
    releaseErroredSessions != null && allErroredSessions != null
      ? releaseErroredSessions - allErroredSessions
      : null;

  const releaseUnhandledSessions = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.UNHANDLED
  );
  const allUnhandledSessions = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.UNHANDLED
  );
  const diffUnhandledSessions =
    releaseUnhandledSessions != null && allUnhandledSessions != null
      ? releaseUnhandledSessions - allUnhandledSessions
      : null;

  const releaseCrashedSessions = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.CRASHED
  );
  const allCrashedSessions = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.SESSIONS,
    SessionStatus.CRASHED
  );
  const diffCrashedSessions =
    releaseCrashedSessions != null && allCrashedSessions != null
      ? releaseCrashedSessions - allCrashedSessions
      : null;

  const releaseCrashFreeUsers = getCrashFreeRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.USERS
  );
  const allCrashFreeUsers = getCrashFreeRate(
    allSessions?.groups,
    SessionFieldWithOperation.USERS
  );
  const diffCrashFreeUsers =
    releaseCrashFreeUsers != null && allCrashFreeUsers != null
      ? releaseCrashFreeUsers - allCrashFreeUsers
      : null;

  const releaseHealthyUsers = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.HEALTHY
  );
  const allHealthyUsers = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.HEALTHY
  );
  const diffHealthyUsers =
    releaseHealthyUsers != null && allHealthyUsers != null
      ? releaseHealthyUsers - allHealthyUsers
      : null;

  const releaseAbnormalUsers = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.ABNORMAL
  );
  const allAbnormalUsers = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.ABNORMAL
  );
  const diffAbnormalUsers =
    releaseAbnormalUsers != null && allAbnormalUsers != null
      ? releaseAbnormalUsers - allAbnormalUsers
      : null;

  const releaseErroredUsers = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.ERRORED
  );
  const allErroredUsers = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.ERRORED
  );
  const diffErroredUsers =
    releaseErroredUsers != null && allErroredUsers != null
      ? releaseErroredUsers - allErroredUsers
      : null;

  const releaseUnhandledUsers = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.UNHANDLED
  );
  const allUnhandledUsers = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.UNHANDLED
  );
  const diffUnhandledUsers =
    releaseUnhandledUsers != null && allUnhandledUsers != null
      ? releaseUnhandledUsers - allUnhandledUsers
      : null;

  const releaseCrashedUsers = getSessionStatusRate(
    releaseSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.CRASHED
  );
  const allCrashedUsers = getSessionStatusRate(
    allSessions?.groups,
    SessionFieldWithOperation.USERS,
    SessionStatus.CRASHED
  );
  const diffCrashedUsers =
    releaseCrashedUsers != null && allCrashedUsers != null
      ? releaseCrashedUsers - allCrashedUsers
      : null;

  const releaseSessionsCount = getCount(
    releaseSessions?.groups,
    SessionFieldWithOperation.SESSIONS
  );
  const allSessionsCount = getCount(
    allSessions?.groups,
    SessionFieldWithOperation.SESSIONS
  );

  const releaseUsersCount = getCount(
    releaseSessions?.groups,
    SessionFieldWithOperation.USERS
  );
  const allUsersCount = getCount(allSessions?.groups, SessionFieldWithOperation.USERS);

  const diffFailure =
    eventsTotals?.releaseFailureRate && eventsTotals?.allFailureRate
      ? eventsTotals.releaseFailureRate - eventsTotals.allFailureRate
      : null;

  if (hasHealthData) {
    charts.push({
      type: ReleaseComparisonChartType.CRASH_FREE_SESSIONS,
      role: 'parent',
      drilldown: (
        <Fragment>
          {issuesTotals?.handled == null ? null : (
            <Tooltip title={t('Open in Issues')}>
              <Link
                to={{
                  ...getReleaseHandledIssuesUrl(
                    organization.slug,
                    project.id,
                    release.version,
                    {start, end, period: period ?? undefined}
                  ),
                  query: {
                    ...extractSelectionParameters(location.query),
                    ...getReleaseHandledIssuesUrl(
                      organization.slug,
                      project.id,
                      release.version,
                      {start, end, period: period ?? undefined}
                    ).query,
                  },
                }}
              >
                {tct('[count] handled [issues]', {
                  count: issuesTotals?.handled
                    ? issuesTotals.handled >= 100
                      ? '99+'
                      : issuesTotals.handled
                    : 0,
                  issues: tn('issue', 'issues', issuesTotals?.handled),
                })}
              </Link>
            </Tooltip>
          )}
          {issuesTotals?.unhandled == null ? null : (
            <Tooltip title={t('Open in issues')}>
              <Link
                to={{
                  ...getReleaseUnhandledIssuesUrl(
                    organization.slug,
                    project.id,
                    release.version,
                    {start, end, period: period ?? undefined}
                  ),
                  query: {
                    ...extractSelectionParameters(location.query),
                    ...getReleaseUnhandledIssuesUrl(
                      organization.slug,
                      project.id,
                      release.version,
                      {start, end, period: period ?? undefined}
                    ).query,
                  },
                }}
              >
                {tct('[count] unhandled [issues]', {
                  count: issuesTotals?.unhandled
                    ? issuesTotals.unhandled >= 100
                      ? '99+'
                      : issuesTotals.unhandled
                    : 0,
                  issues: tn('issue', 'issues', issuesTotals?.unhandled),
                })}
              </Link>
            </Tooltip>
          )}
        </Fragment>
      ),
      thisRelease:
        releaseCrashFreeSessions == null
          ? null
          : displaySessionStatusPercent(releaseCrashFreeSessions),
      allReleases:
        allCrashFreeSessions == null
          ? null
          : displaySessionStatusPercent(allCrashFreeSessions),
      diff:
        diffCrashFreeSessions == null
          ? null
          : displaySessionStatusPercent(diffCrashFreeSessions),
      diffDirection: diffCrashFreeSessions
        ? diffCrashFreeSessions > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: diffCrashFreeSessions
        ? diffCrashFreeSessions > 0
          ? theme.tokens.content.success
          : theme.tokens.content.danger
        : null,
    });
    if (expanded.has(ReleaseComparisonChartType.CRASH_FREE_SESSIONS)) {
      charts.push(
        {
          type: ReleaseComparisonChartType.HEALTHY_SESSIONS,
          role: 'children',
          drilldown: null,
          thisRelease:
            releaseHealthySessions == null
              ? null
              : displaySessionStatusPercent(releaseHealthySessions),
          allReleases:
            allHealthySessions == null
              ? null
              : displaySessionStatusPercent(allHealthySessions),
          diff:
            diffHealthySessions == null
              ? null
              : displaySessionStatusPercent(diffHealthySessions),
          diffDirection: diffHealthySessions
            ? diffHealthySessions > 0
              ? 'up'
              : 'down'
            : null,
          diffColor: diffHealthySessions
            ? diffHealthySessions > 0
              ? theme.tokens.content.success
              : theme.tokens.content.danger
            : null,
        },
        {
          type: ReleaseComparisonChartType.ABNORMAL_SESSIONS,
          role: 'children',
          drilldown: null,
          thisRelease:
            releaseAbnormalSessions == null
              ? null
              : displaySessionStatusPercent(releaseAbnormalSessions),
          allReleases:
            allAbnormalSessions == null
              ? null
              : displaySessionStatusPercent(allAbnormalSessions),
          diff:
            diffAbnormalSessions == null
              ? null
              : displaySessionStatusPercent(diffAbnormalSessions),
          diffDirection: diffAbnormalSessions
            ? diffAbnormalSessions > 0
              ? 'up'
              : 'down'
            : null,
          diffColor: diffAbnormalSessions
            ? diffAbnormalSessions > 0
              ? theme.tokens.content.danger
              : theme.tokens.content.success
            : null,
        },
        {
          type: ReleaseComparisonChartType.ERRORED_SESSIONS,
          tooltip: t(
            'An errored sessions is a session where an error was caught by the application and reported to Sentry.'
          ),
          role: 'children',
          drilldown: null,
          thisRelease:
            releaseErroredSessions == null
              ? null
              : displaySessionStatusPercent(releaseErroredSessions),
          allReleases:
            allErroredSessions == null
              ? null
              : displaySessionStatusPercent(allErroredSessions),
          diff:
            diffErroredSessions == null
              ? null
              : displaySessionStatusPercent(diffErroredSessions),
          diffDirection: diffErroredSessions
            ? diffErroredSessions > 0
              ? 'up'
              : 'down'
            : null,
          diffColor: diffErroredSessions
            ? diffErroredSessions > 0
              ? theme.tokens.content.danger
              : theme.tokens.content.success
            : null,
        },
        {
          type: ReleaseComparisonChartType.UNHANDLED_SESSIONS,
          tooltip: t(
            'If an error is not specifically handled by application code the session becomes unhandled.'
          ),
          role: 'children',
          drilldown: null,
          thisRelease:
            releaseUnhandledSessions == null
              ? null
              : displaySessionStatusPercent(releaseUnhandledSessions),
          allReleases:
            allUnhandledSessions == null
              ? null
              : displaySessionStatusPercent(allUnhandledSessions),
          diff:
            diffUnhandledSessions == null
              ? null
              : displaySessionStatusPercent(diffUnhandledSessions),
          diffDirection: diffUnhandledSessions
            ? diffUnhandledSessions > 0
              ? 'up'
              : 'down'
            : null,
          diffColor: diffUnhandledSessions
            ? diffUnhandledSessions > 0
              ? theme.tokens.content.danger
              : theme.tokens.content.success
            : null,
        },
        {
          type: ReleaseComparisonChartType.CRASHED_SESSIONS,
          tooltip: t(
            'Some languages or frameworks will cause the application to crash when an unhandled error occurs.'
          ),
          role: 'default',
          drilldown: null,
          thisRelease:
            releaseCrashedSessions == null
              ? null
              : displaySessionStatusPercent(releaseCrashedSessions),
          allReleases:
            allCrashedSessions == null
              ? null
              : displaySessionStatusPercent(allCrashedSessions),
          diff:
            diffCrashedSessions == null
              ? null
              : displaySessionStatusPercent(diffCrashedSessions),
          diffDirection: diffCrashedSessions
            ? diffCrashedSessions > 0
              ? 'up'
              : 'down'
            : null,
          diffColor: diffCrashedSessions
            ? diffCrashedSessions > 0
              ? theme.tokens.content.danger
              : theme.tokens.content.success
            : null,
        }
      );
    }
  }

  const hasUsers = !!getCount(releaseSessions?.groups, SessionFieldWithOperation.USERS);
  if (hasHealthData && (hasUsers || loading)) {
    charts.push({
      type: ReleaseComparisonChartType.CRASH_FREE_USERS,
      role: 'parent',
      drilldown: null,
      thisRelease:
        releaseCrashFreeUsers == null
          ? null
          : displaySessionStatusPercent(releaseCrashFreeUsers),
      allReleases:
        allCrashFreeUsers == null ? null : displaySessionStatusPercent(allCrashFreeUsers),
      diff:
        diffCrashFreeUsers == null
          ? null
          : displaySessionStatusPercent(diffCrashFreeUsers),
      diffDirection: diffCrashFreeUsers ? (diffCrashFreeUsers > 0 ? 'up' : 'down') : null,
      diffColor: diffCrashFreeUsers
        ? diffCrashFreeUsers > 0
          ? theme.tokens.content.success
          : theme.tokens.content.danger
        : null,
    });
    if (expanded.has(ReleaseComparisonChartType.CRASH_FREE_USERS)) {
      charts.push(
        {
          type: ReleaseComparisonChartType.HEALTHY_USERS,
          role: 'children',
          drilldown: null,
          thisRelease:
            releaseHealthyUsers == null
              ? null
              : displaySessionStatusPercent(releaseHealthyUsers),
          allReleases:
            allHealthyUsers == null ? null : displaySessionStatusPercent(allHealthyUsers),
          diff:
            diffHealthyUsers == null
              ? null
              : displaySessionStatusPercent(diffHealthyUsers),
          diffDirection: diffHealthyUsers ? (diffHealthyUsers > 0 ? 'up' : 'down') : null,
          diffColor: diffHealthyUsers
            ? diffHealthyUsers > 0
              ? theme.tokens.content.success
              : theme.tokens.content.danger
            : null,
        },
        {
          type: ReleaseComparisonChartType.ABNORMAL_USERS,
          role: 'children',
          drilldown: null,
          thisRelease:
            releaseAbnormalUsers == null
              ? null
              : displaySessionStatusPercent(releaseAbnormalUsers),
          allReleases:
            allAbnormalUsers == null
              ? null
              : displaySessionStatusPercent(allAbnormalUsers),
          diff:
            diffAbnormalUsers == null
              ? null
              : displaySessionStatusPercent(diffAbnormalUsers),
          diffDirection: diffAbnormalUsers
            ? diffAbnormalUsers > 0
              ? 'up'
              : 'down'
            : null,
          diffColor: diffAbnormalUsers
            ? diffAbnormalUsers > 0
              ? theme.tokens.content.danger
              : theme.tokens.content.success
            : null,
        },
        {
          type: ReleaseComparisonChartType.ERRORED_USERS,
          role: 'children',
          drilldown: null,
          thisRelease:
            releaseErroredUsers == null
              ? null
              : displaySessionStatusPercent(releaseErroredUsers),
          allReleases:
            allErroredUsers == null ? null : displaySessionStatusPercent(allErroredUsers),
          diff:
            diffErroredUsers == null
              ? null
              : displaySessionStatusPercent(diffErroredUsers),
          diffDirection: diffErroredUsers ? (diffErroredUsers > 0 ? 'up' : 'down') : null,
          diffColor: diffErroredUsers
            ? diffErroredUsers > 0
              ? theme.tokens.content.danger
              : theme.tokens.content.success
            : null,
        },
        {
          type: ReleaseComparisonChartType.UNHANDLED_USERS,
          role: 'children',
          drilldown: null,
          thisRelease:
            releaseUnhandledUsers == null
              ? null
              : displaySessionStatusPercent(releaseUnhandledUsers),
          allReleases:
            allUnhandledUsers == null
              ? null
              : displaySessionStatusPercent(allUnhandledUsers),
          diff:
            diffUnhandledUsers == null
              ? null
              : displaySessionStatusPercent(diffUnhandledUsers),
          diffDirection: diffUnhandledUsers
            ? diffUnhandledUsers > 0
              ? 'up'
              : 'down'
            : null,
          diffColor: diffUnhandledUsers
            ? diffUnhandledUsers > 0
              ? theme.tokens.content.danger
              : theme.tokens.content.success
            : null,
        },
        {
          type: ReleaseComparisonChartType.CRASHED_USERS,
          role: 'default',
          drilldown: null,
          thisRelease:
            releaseCrashedUsers == null
              ? null
              : displaySessionStatusPercent(releaseCrashedUsers),
          allReleases:
            allCrashedUsers == null ? null : displaySessionStatusPercent(allCrashedUsers),
          diff:
            diffCrashedUsers == null
              ? null
              : displaySessionStatusPercent(diffCrashedUsers),
          diffDirection: diffCrashedUsers ? (diffCrashedUsers > 0 ? 'up' : 'down') : null,
          diffColor: diffCrashedUsers
            ? diffCrashedUsers > 0
              ? theme.tokens.content.danger
              : theme.tokens.content.success
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
      diffColor: diffFailure
        ? diffFailure > 0
          ? theme.tokens.content.danger
          : theme.tokens.content.success
        : null,
    });
  }

  if (hasHealthData) {
    additionalCharts.push({
      type: ReleaseComparisonChartType.SESSION_COUNT,
      role: 'default',
      drilldown: null,
      thisRelease: <Count value={releaseSessionsCount} />,
      allReleases: <Count value={allSessionsCount} />,
      diff: null,
      diffDirection: null,
      diffColor: null,
    });
    if (hasUsers || loading) {
      additionalCharts.push({
        type: ReleaseComparisonChartType.USER_COUNT,
        role: 'default',
        drilldown: null,
        thisRelease: <Count value={releaseUsersCount} />,
        allReleases: <Count value={allUsersCount} />,
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
      thisRelease:
        eventsTotals?.releaseErrorCount == null ? null : (
          <Count value={eventsTotals?.releaseErrorCount} />
        ),
      allReleases:
        eventsTotals?.allErrorCount == null ? null : (
          <Count value={eventsTotals?.allErrorCount} />
        ),
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
      thisRelease:
        eventsTotals?.releaseTransactionCount == null ? null : (
          <Count value={eventsTotals?.releaseTransactionCount} />
        ),
      allReleases:
        eventsTotals?.allTransactionCount == null ? null : (
          <Count value={eventsTotals?.allTransactionCount} />
        ),
      diff: null,
      diffDirection: null,
      diffColor: null,
    });
  }

  function handleChartChange(chartType: ReleaseComparisonChartType) {
    trackAnalytics('releases.change_chart_type', {
      organization,
      chartType,
    });
    navigate({
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
      <Change color={diffColor == null ? undefined : diffColor}>
        {diff}{' '}
        {diffDirection ? (
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
    chart = charts[0]!;
    activeChart = charts[0]!.type;
  }

  const showPlaceholders = loading || eventsLoading;
  const withExpanders = hasHealthData || additionalCharts.length > 0;

  if (errored || !chart) {
    return (
      <Panel>
        <ErrorPanel>
          <IconWarning variant="muted" size="lg" />
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
        <ErrorBoundary mini>
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
        </ErrorBoundary>
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
            <Flex justify="end" align="center" column="2 / -1">
              <Button
                variant="transparent"
                size="zero"
                icon={<IconChevron direction={isOtherExpanded ? 'up' : 'down'} />}
                aria-label={t('Toggle additional charts')}
              />
            </Flex>
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
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const DescriptionCell = styled(Cell)`
  text-align: left;
  overflow: visible;
`;

const Change = styled('div')<{color?: string}>`
  font-size: ${p => p.theme.font.size.md};
  ${p => p.color && `color: ${p.color}`}
`;

const ChartTable = styled(PanelTable)<{withExpanders: boolean}>`
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  grid-template-columns: minmax(400px, auto) repeat(3, minmax(min-content, 1fr)) ${p =>
      p.withExpanders ? '75px' : ''};

  > * {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
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
    padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  }
`;

const ShowMoreTitle = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  display: inline-grid;
  grid-template-columns: auto auto;
  gap: 10px;
  align-items: center;
  justify-content: flex-start;
  svg {
    margin-left: ${p => p.theme.space['2xs']};
  }
`;
