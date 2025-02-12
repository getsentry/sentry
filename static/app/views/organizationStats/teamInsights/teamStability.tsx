import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import round from 'lodash/round';

import {LinkButton} from 'sentry/components/button';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import LoadingError from 'sentry/components/loadingError';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PanelTable} from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import {SessionFieldWithOperation, SessionStatus} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatFloat} from 'sentry/utils/number/formatFloat';
import {useApiQuery} from 'sentry/utils/queryClient';
import {getCountSeries, getCrashFreeRate, getSeriesSum} from 'sentry/utils/sessions';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {displayCrashFreePercent} from 'sentry/views/releases/utils';

import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {groupByTrend} from './utils';

interface TeamStabilityProps extends DateTimeObject {
  organization: Organization;
  projects: Project[];
}

function TeamStability({
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
      `/organizations/${organization.slug}/sessions/`,
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
      `/organizations/${organization.slug}/sessions/`,
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
    const countSeriesWeeklyTotals: number[] = new Array(sumSessionsCount).fill(0);
    countSeries.forEach(
      (s, idx) => (countSeriesWeeklyTotals[Math.floor(idx / 7)]! += s.value)
    );

    const sumSessionsWeeklyTotals: number[] = new Array(sumSessionsCount).fill(0);
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
      <SubText color={trend >= 0 ? 'successText' : 'errorText'}>
        {`${round(Math.abs(trend), 3)}\u0025`}
        <PaddedIconArrow direction={trend >= 0 ? 'up' : 'down'} size="xs" />
      </SubText>
    );
  }

  const sortedProjects = projects
    .map(project => ({project, trend: getTrend(Number(project.id)) ?? 0}))
    .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));

  const groupedProjects = groupByTrend(sortedProjects);

  return (
    <StyledPanelTable
      isEmpty={projects.length === 0}
      emptyMessage={t('No projects with release health enabled')}
      emptyAction={
        <LinkButton
          size="sm"
          external
          href="https://docs.sentry.io/platforms/dotnet/guides/nlog/configuration/releases/#release-health"
        >
          {t('Learn More')}
        </LinkButton>
      }
      headers={[
        t('Project'),
        <RightAligned key="last">{tct('Last [period]', {period})}</RightAligned>,
        <RightAligned key="avg">{tct('[period] Avg', {period})}</RightAligned>,
        <RightAligned key="curr">{t('Last 7 Days')}</RightAligned>,
        <RightAligned key="diff">{t('Difference')}</RightAligned>,
      ]}
    >
      {groupedProjects.map(({project}) => (
        <Fragment key={project.id}>
          <ProjectBadgeContainer>
            <ProjectBadge avatarSize={18} project={project} />
          </ProjectBadgeContainer>

          <div>
            {periodSessions && weekSessions && !isLoading && (
              <MiniBarChart
                isGroupedByDate
                showTimeInTooltip
                series={getMiniBarChartSeries(project, periodSessions)}
                height={25}
                tooltipFormatter={(value: number) => `${value.toLocaleString()}%`}
              />
            )}
          </div>
          <ScoreWrapper>{renderScore(project.id, 'period')}</ScoreWrapper>
          <ScoreWrapper>{renderScore(project.id, 'week')}</ScoreWrapper>
          <ScoreWrapper>{renderTrend(project.id)}</ScoreWrapper>
        </Fragment>
      ))}
    </StyledPanelTable>
  );
}

export default TeamStability;

const StyledPanelTable = styled(PanelTable)<{isEmpty: boolean}>`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.2fr 0.2fr;
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  box-shadow: unset;
  /* overflow when bar chart tooltip gets cutoff for the top row */
  overflow: visible;

  & > div {
    padding: ${space(1)} ${space(2)};
  }

  ${p =>
    p.isEmpty &&
    css`
      & > div:last-child {
        padding: 48px ${space(2)};
      }
    `}
`;

const RightAligned = styled('span')`
  text-align: right;
`;

const ScoreWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  text-align: right;
`;

const PaddedIconArrow = styled(IconArrow)`
  margin: 0 ${space(0.5)};
`;

const SubText = styled('div')<{color: ColorOrAlias}>`
  color: ${p => p.theme[p.color]};
`;
