import {Fragment, useEffect, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location} from 'history';

import {Client} from 'app/api';
import ErrorPanel from 'app/components/charts/errorPanel';
import {ChartContainer} from 'app/components/charts/styles';
import Count from 'app/components/count';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import NotAvailable from 'app/components/notAvailable';
import {Panel, PanelTable} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import Radio from 'app/components/radio';
import Tooltip from 'app/components/tooltip';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {PlatformKey} from 'app/data/platformCategories';
import {IconArrow, IconWarning} from 'app/icons';
import {t, tct, tn} from 'app/locale';
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
import {getCount, getCrashFreeRate, getSessionStatusRate} from 'app/utils/sessions';
import {Color} from 'app/utils/theme';
import {QueryResults} from 'app/utils/tokenizeSearch';
import {
  displaySessionStatusPercent,
  getReleaseBounds,
  getReleaseHandledIssuesUrl,
  getReleaseParams,
  getReleaseUnhandledIssuesUrl,
} from 'app/views/releases/utils';

import {releaseComparisonChartLabels} from '../../utils';

import ReleaseEventsChart from './releaseEventsChart';
import ReleaseSessionsChart from './releaseSessionsChart';

type ComparisonRow = {
  type: ReleaseComparisonChartType;
  thisRelease: React.ReactNode;
  allReleases: React.ReactNode;
  diff: React.ReactNode;
  diffDirection: 'up' | 'down' | null;
  diffColor: Color | null;
  role: 'parent' | 'children' | 'default';
  drilldown: React.ReactNode;
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
  api: Client;
  organization: Organization;
  hasHealthData: boolean;
};

type EventsTotals = {
  allErrorCount: number;
  releaseErrorCount: number;
  allTransactionCount: number;
  releaseTransactionCount: number;
  releaseFailureRate: number;
  allFailureRate: number;
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
  const charts: ComparisonRow[] = [];
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
        defaultStatsPeriod: DEFAULT_STATS_PERIOD, // this will be removed once we get rid off legacy release details
        allowEmptyPeriod: true,
      }),
    [release, location]
  );

  useEffect(() => {
    if (hasDiscover || hasPerformance) {
      fetchEventsTotals();
      fetchIssuesTotals();
    }
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

  const diffFailure =
    eventsTotals?.releaseFailureRate && eventsTotals?.allFailureRate
      ? eventsTotals.releaseFailureRate - eventsTotals.allFailureRate
      : null;

  if (hasHealthData) {
    charts.push(
      {
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
      },
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

  const hasUsers = !!getCount(releaseSessions?.groups, SessionField.USERS);
  if (hasHealthData && (hasUsers || loading)) {
    charts.push(
      {
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
        diffDirection: diffCrashFreeUsers
          ? diffCrashFreeUsers > 0
            ? 'up'
            : 'down'
          : null,
        diffColor: diffCrashFreeUsers
          ? diffCrashFreeUsers > 0
            ? 'green300'
            : 'red300'
          : null,
      },
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
        diffDirection: diffAbnormalUsers ? (diffAbnormalUsers > 0 ? 'up' : 'down') : null,
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
    charts.push(
      {
        type: ReleaseComparisonChartType.SESSION_COUNT,
        role: 'default',
        drilldown: null,
        thisRelease: defined(releaseSessionsCount) ? (
          <Count value={releaseSessionsCount} />
        ) : null,
        allReleases: defined(allSessionsCount) ? (
          <Count value={allSessionsCount} />
        ) : null,
        diff: null,
        diffDirection: null,
        diffColor: null,
      },
      {
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
      }
    );
  }

  if (hasDiscover) {
    charts.push({
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
    charts.push({
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

  function getChartDiff(
    diff: ComparisonRow['diff'],
    diffColor: ComparisonRow['diffColor'],
    diffDirection: ComparisonRow['diffDirection']
  ) {
    return diff ? (
      <Change color={defined(diffColor) ? diffColor : undefined}>
        {diff}{' '}
        {defined(diffDirection) && <IconArrow direction={diffDirection} size="xs" />}
      </Change>
    ) : null;
  }

  let activeChart = decodeScalar(
    location.query.chart,
    hasHealthData
      ? ReleaseComparisonChartType.CRASH_FREE_SESSIONS
      : hasPerformance
      ? ReleaseComparisonChartType.FAILURE_RATE
      : ReleaseComparisonChartType.ERROR_COUNT
  ) as ReleaseComparisonChartType;

  let chart = charts.find(ch => ch.type === activeChart);

  if (!chart) {
    chart = charts[0];
    activeChart = charts[0].type;
  }

  const showPlaceholders = loading || eventsLoading;

  if (errored || !chart) {
    return (
      <Panel>
        <ErrorPanel>
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      </Panel>
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
          ].includes(activeChart) ? (
            <ReleaseEventsChart
              version={release.version}
              chartType={activeChart}
              period={period ?? undefined}
              start={start}
              end={end}
              utc={utc === 'true'}
              value={chart.thisRelease}
              diff={getChartDiff(chart.diff, chart.diffColor, chart.diffDirection)}
            />
          ) : (
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
              diff={getChartDiff(chart.diff, chart.diffColor, chart.diffDirection)}
              loading={loading}
              reloading={reloading}
            />
          )}
        </ChartContainer>
      </ChartPanel>
      <ChartTable
        headers={[
          <DescriptionCell key="description">{t('Description')}</DescriptionCell>,
          <Cell key="releases">{t('All Releases')}</Cell>,
          <Cell key="release">{t('This Release')}</Cell>,
          <Cell key="change">{t('Change')}</Cell>,
        ]}
      >
        {charts.map(
          ({
            type,
            role,
            drilldown,
            thisRelease,
            allReleases,
            diff,
            diffDirection,
            diffColor,
          }) => {
            return (
              <ChartTableRow
                key={type}
                htmlFor={type}
                isActive={type === activeChart}
                isLoading={showPlaceholders}
                role={role}
              >
                <DescriptionCell>
                  <TitleWrapper>
                    <Radio
                      id={type}
                      disabled={false}
                      checked={type === activeChart}
                      onChange={() => handleChartChange(type)}
                    />
                    {releaseComparisonChartLabels[type]}&nbsp;{drilldown}
                  </TitleWrapper>
                </DescriptionCell>
                <Cell>
                  {showPlaceholders ? (
                    <Placeholder height="20px" />
                  ) : defined(allReleases) ? (
                    allReleases
                  ) : (
                    <NotAvailable />
                  )}
                </Cell>
                <Cell>
                  {showPlaceholders ? (
                    <Placeholder height="20px" />
                  ) : defined(thisRelease) ? (
                    thisRelease
                  ) : (
                    <NotAvailable />
                  )}
                </Cell>
                <Cell>
                  {showPlaceholders ? (
                    <Placeholder height="20px" />
                  ) : defined(diff) ? (
                    getChartDiff(diff, diffColor, diffDirection)
                  ) : (
                    <NotAvailable />
                  )}
                </Cell>
              </ChartTableRow>
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

const Cell = styled('div')`
  text-align: right;
  ${overflowEllipsis}
`;

const DescriptionCell = styled(Cell)`
  text-align: left;
  overflow: visible;
`;

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  position: relative;
  z-index: 1;
  background: ${p => p.theme.background};

  input {
    flex-shrink: 0;
    background-color: ${p => p.theme.background};
    margin-right: ${space(1)} !important;

    &:hover {
      cursor: pointer;
    }
  }
`;

const Change = styled('div')<{color?: Color}>`
  font-size: ${p => p.theme.fontSizeLarge};
  ${p => p.color && `color: ${p.theme[p.color]}`}
`;

const ChartTableRow = styled('label')<{
  isActive: boolean;
  role: ComparisonRow['role'];
  isLoading: boolean;
}>`
  display: contents;
  font-weight: 400;
  margin-bottom: 0;

  > * {
    padding: ${space(2)};
  }

  ${p =>
    p.isActive &&
    !p.isLoading &&
    css`
      ${Cell}, ${DescriptionCell}, ${TitleWrapper} {
        background-color: ${p.theme.bodyBackground};
      }
    `}

  &:hover {
    cursor: pointer;
    ${/* sc-selector */ Cell}, ${/* sc-selector */ DescriptionCell}, ${
      /* sc-selector */ TitleWrapper
    } {
      ${p => !p.isLoading && `background-color: ${p.theme.bodyBackground}`}
    }
  }

  ${p =>
    p.role === 'default' &&
    css`
      &:not(:last-child) {
        ${Cell}, ${DescriptionCell} {
          border-bottom: 1px solid ${p.theme.border};
        }
      }
    `}

  ${p =>
    p.role === 'parent' &&
    css`
      ${Cell}, ${DescriptionCell} {
        margin-top: ${space(0.75)};
      }
    `}

  ${p =>
    p.role === 'children' &&
    css`
      ${DescriptionCell} {
        padding-left: 50px;
        position: relative;
        &:before {
          content: '';
          width: 15px;
          height: 36px;
          position: absolute;
          top: -17px;
          left: 27px;
          border-bottom: 1px solid ${p.theme.border};
          border-left: 1px solid ${p.theme.border};
        }
      }
    `}

    ${p =>
    (p.role === 'parent' || p.role === 'children') &&
    css`
      ${Cell}, ${DescriptionCell} {
        padding-bottom: ${space(0.75)};
        padding-top: ${space(0.75)};
        border-bottom: 0;
      }
    `}
`;

const ChartTable = styled(PanelTable)`
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  grid-template-columns: minmax(424px, auto) repeat(3, minmax(min-content, 1fr));

  > * {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(4, minmax(min-content, 1fr));
  }
`;

export default ReleaseComparisonChart;
