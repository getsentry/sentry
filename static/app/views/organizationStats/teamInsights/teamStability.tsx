import styled from '@emotion/styled';
import round from 'lodash/round';

import {LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Text} from '@sentry/scraps/text';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {LoadingError} from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import {SessionFieldWithOperation, SessionStatus} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {formatFloat} from 'sentry/utils/number/formatFloat';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getCountSeries, getCrashFreeRate, getSeriesSum} from 'sentry/utils/sessions';
import {displayCrashFreePercent} from 'sentry/views/explore/releases/utils';

import {ProjectBadge, ProjectBadgeContainer, TeamInsightsTable} from './styles';
import {groupByTrend} from './utils';

interface TeamStabilityProps extends DateTimeObject {
  organization: Organization;
  projects: Project[];
}

export function TeamStability({
  organization,
  projects,
  period,
  start,
  end,
  utc,
}: TeamStabilityProps) {
  const projectsWithSessions = projects.filter(project => project.hasSessions);
  const datetime = {start, end, period, utc};
  const commonQuery = {
    environment: [],
    project: projectsWithSessions.map(p => p.id),
    field: 'sum(session)',
    groupBy: ['session.status', 'project'],
    interval: '1d',
  };

  const {
    data: periodSessions,
    isPending: isPeriodSessionsLoading,
    isError: isPeriodSessionsError,
    refetch: refetchPeriodSessions,
  } = useApiQuery<SessionApiResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sessions/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          ...commonQuery,
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
    {staleTime: 5000}
  );

  const {
    data: weekSessions,
    isPending: isWeekSessionsLoading,
    isError: isWeekSessionsError,
    refetch: refetchWeekSessions,
  } = useApiQuery<SessionApiResponse>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sessions/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          ...commonQuery,
          statsPeriod: '7d',
        },
      },
    ],
    {staleTime: 5000}
  );

  const isLoading = isPeriodSessionsLoading || isWeekSessionsLoading;

  if (isPeriodSessionsError || isWeekSessionsError) {
    return (
      <LoadingError
        onRetry={() => {
          refetchPeriodSessions();
          refetchWeekSessions();
        }}
      />
    );
  }

  function getScore(projectId: number, dataset: 'week' | 'period'): number | null {
    const sessions = dataset === 'week' ? weekSessions : periodSessions;
    const projectGroups = sessions?.groups.filter(
      group => group.by.project === projectId
    );

    return getCrashFreeRate(projectGroups, SessionFieldWithOperation.SESSIONS);
  }

  function getTrend(projectId: number): number | null {
    const periodScore = getScore(projectId, 'period');
    const weekScore = getScore(projectId, 'week');

    if (periodScore === null || weekScore === null) {
      return null;
    }

    return weekScore - periodScore;
  }

  function getMiniBarChartSeries(project: Project, response: SessionApiResponse) {
    const sumSessions = getSeriesSum(
      response.groups.filter(group => group.by.project === Number(project.id)),
      SessionFieldWithOperation.SESSIONS,
      response.intervals
    );

    const countSeries = getCountSeries(
      SessionFieldWithOperation.SESSIONS,
      response.groups.find(
        g =>
          g.by.project === Number(project.id) &&
          g.by['session.status'] === SessionStatus.HEALTHY
      ),
      response.intervals
    );

    const sumSessionsCount = Math.floor(sumSessions.length / 7);
    const countSeriesWeeklyTotals = Array.from<number>({length: sumSessionsCount}).fill(
      0
    );
    countSeries.forEach(
      (s, idx) => (countSeriesWeeklyTotals[Math.floor(idx / 7)]! += s.value)
    );

    const sumSessionsWeeklyTotals = Array.from<number>({length: sumSessionsCount}).fill(
      0
    );
    sumSessions.forEach((s, idx) => (sumSessionsWeeklyTotals[Math.floor(idx / 7)]! += s));

    const data = countSeriesWeeklyTotals.map((value, idx) => ({
      name: countSeries[idx * 7]!.name,
      value: sumSessionsWeeklyTotals[idx]
        ? formatFloat((value / sumSessionsWeeklyTotals[idx]) * 100, 2)
        : 0,
    }));

    return [{seriesName: t('Crash Free Sessions'), data}];
  }

  function renderScore(projectId: string, dataset: 'week' | 'period') {
    if (isLoading) {
      return (
        <div>
          <Placeholder width="80px" height="25px" />
        </div>
      );
    }

    const score = getScore(Number(projectId), dataset);

    if (score === null) {
      return '\u2014';
    }

    return displayCrashFreePercent(score);
  }

  function renderTrend(projectId: string) {
    if (isLoading) {
      return (
        <div>
          <Placeholder width="80px" height="25px" />
        </div>
      );
    }

    const trend = getTrend(Number(projectId));

    if (trend === null) {
      return '\u2014';
    }

    return (
      <Text variant={trend >= 0 ? 'success' : 'danger'}>
        {`${round(Math.abs(trend), 3)}\u0025`}
        <PaddedIconArrow direction={trend >= 0 ? 'up' : 'down'} size="xs" />
      </Text>
    );
  }

  const sortedProjects = projects
    .map(project => ({project, trend: getTrend(Number(project.id)) ?? 0}))
    .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));

  const groupedProjects = groupByTrend(sortedProjects);

  return (
    <StyledSimpleTable
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>
            <RightAligned>{tct('Last [period]', {period})}</RightAligned>
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>
            <RightAligned>{tct('[period] Avg', {period})}</RightAligned>
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>
            <RightAligned>{t('Last 7 Days')}</RightAligned>
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>
            <RightAligned>{t('Difference')}</RightAligned>
          </SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {projects.length === 0 ? (
        <SimpleTable.Empty>
          <EmptyState
            title={t('No projects with release health enabled')}
            action={
              <LinkButton
                size="sm"
                external
                href="https://docs.sentry.io/platforms/dotnet/guides/nlog/configuration/releases/#release-health"
              >
                {t('Learn More')}
              </LinkButton>
            }
          />
        </SimpleTable.Empty>
      ) : (
        groupedProjects.map(({project}) => (
          <SimpleTable.Row key={project.id}>
            <SimpleTable.RowCell>
              <ProjectBadgeContainer>
                <ProjectBadge avatarSize={18} project={project} />
              </ProjectBadgeContainer>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              {periodSessions && weekSessions && !isLoading && (
                <MiniBarChart
                  isGroupedByDate
                  showTimeInTooltip
                  series={getMiniBarChartSeries(project, periodSessions)}
                  height={25}
                  tooltip={{
                    appendToBody: true,
                    trigger: 'axis',
                    valueFormatter: value => `${Number(value).toLocaleString()}%`,
                  }}
                />
              )}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              {renderScore(project.id, 'period')}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              {renderScore(project.id, 'week')}
            </SimpleTable.RowCell>
            <SimpleTable.RowCell justify="end">
              {renderTrend(project.id)}
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        ))
      )}
    </StyledSimpleTable>
  );
}

const StyledSimpleTable = styled(TeamInsightsTable)`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.2fr 0.2fr;
`;

const RightAligned = styled('span')`
  text-align: right;
`;

const PaddedIconArrow = styled(IconArrow)`
  margin: 0 ${p => p.theme.space.xs};
`;
