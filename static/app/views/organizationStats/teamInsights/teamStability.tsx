import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import round from 'lodash/round';

import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import SessionsRequest from 'sentry/components/charts/sessionsRequest';
import {DateTimeObject} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {
  Organization,
  Project,
  SessionApiResponse,
  SessionFieldWithOperation,
  SessionStatus,
} from 'sentry/types';
import {formatFloat} from 'sentry/utils/formatters';
import {getCountSeries, getCrashFreeRate, getSeriesSum} from 'sentry/utils/sessions';
import {ColorOrAlias} from 'sentry/utils/theme';
import {displayCrashFreePercent} from 'sentry/views/releases/utils';

import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {groupByTrend} from './utils';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  period?: string | null;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  /** weekly selected date range */
  periodSessions: SessionApiResponse | null;
  /** Locked to last 7 days */
  weekSessions: SessionApiResponse | null;
};

class TeamStability extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      weekSessions: null,
      periodSessions: null,
    };
  }

  getEndpoints() {
    const {organization, start, end, period, utc, projects} = this.props;

    const projectsWithSessions = projects.filter(project => project.hasSessions);

    if (projectsWithSessions.length === 0) {
      return [];
    }

    const datetime = {start, end, period, utc};
    const commonQuery = {
      environment: [],
      project: projectsWithSessions.map(p => p.id),
      field: 'sum(session)',
      groupBy: ['session.status', 'project'],
      interval: '1d',
    };

    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      [
        'periodSessions',
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            ...commonQuery,
            ...normalizeDateTimeParams(datetime),
          },
        },
      ],
      [
        'weekSessions',
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            ...commonQuery,
            statsPeriod: '7d',
          },
        },
      ],
    ];

    return endpoints;
  }

  componentDidUpdate(prevProps: Props) {
    const {projects, start, end, period, utc} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      !isEqual(prevProps.projects, projects)
    ) {
      this.remountComponent();
    }
  }

  getScore(projectId: number, dataset: 'week' | 'period'): number | null {
    const {periodSessions, weekSessions} = this.state;
    const sessions = dataset === 'week' ? weekSessions : periodSessions;
    const projectGroups = sessions?.groups.filter(
      group => group.by.project === projectId
    );

    return getCrashFreeRate(projectGroups, SessionFieldWithOperation.SESSIONS);
  }

  getTrend(projectId: number): number | null {
    const periodScore = this.getScore(projectId, 'period');
    const weekScore = this.getScore(projectId, 'week');

    if (periodScore === null || weekScore === null) {
      return null;
    }

    return weekScore - periodScore;
  }

  getMiniBarChartSeries(project: Project, response: SessionApiResponse) {
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

    const countSeriesWeeklyTotals: number[] = Array(sumSessions.length / 7).fill(0);
    countSeries.forEach(
      (s, idx) => (countSeriesWeeklyTotals[Math.floor(idx / 7)] += s.value)
    );

    const sumSessionsWeeklyTotals: number[] = Array(sumSessions.length / 7).fill(0);
    sumSessions.forEach((s, idx) => (sumSessionsWeeklyTotals[Math.floor(idx / 7)] += s));

    const data = countSeriesWeeklyTotals.map((value, idx) => ({
      name: countSeries[idx * 7].name,
      value: sumSessionsWeeklyTotals[idx]
        ? formatFloat((value / sumSessionsWeeklyTotals[idx]) * 100, 2)
        : 0,
    }));

    return [{seriesName: t('Crash Free Sessions'), data}];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderScore(projectId: string, dataset: 'week' | 'period') {
    const {loading} = this.state;

    if (loading) {
      return (
        <div>
          <Placeholder width="80px" height="25px" />
        </div>
      );
    }

    const score = this.getScore(Number(projectId), dataset);

    if (score === null) {
      return '\u2014';
    }

    return displayCrashFreePercent(score);
  }

  renderTrend(projectId: string) {
    const {loading} = this.state;

    if (loading) {
      return (
        <div>
          <Placeholder width="80px" height="25px" />
        </div>
      );
    }

    const trend = this.getTrend(Number(projectId));

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

  renderBody() {
    const {organization, projects, period} = this.props;

    const sortedProjects = projects
      .map(project => ({project, trend: this.getTrend(Number(project.id)) ?? 0}))
      .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));

    const groupedProjects = groupByTrend(sortedProjects);

    return (
      <SessionsRequest
        api={this.api}
        project={projects.map(({id}) => Number(id))}
        organization={organization}
        interval="1d"
        groupBy={['session.status', 'project']}
        field={[SessionFieldWithOperation.SESSIONS]}
        statsPeriod={period}
      >
        {({response, loading}) => (
          <StyledPanelTable
            isEmpty={projects.length === 0}
            emptyMessage={t('No projects with release health enabled')}
            emptyAction={
              <Button
                size="sm"
                external
                href="https://docs.sentry.io/platforms/dotnet/guides/nlog/configuration/releases/#release-health"
              >
                {t('Learn More')}
              </Button>
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
                  {response && !loading && (
                    <MiniBarChart
                      isGroupedByDate
                      showTimeInTooltip
                      series={this.getMiniBarChartSeries(project, response)}
                      height={25}
                      tooltipFormatter={(value: number) => `${value.toLocaleString()}%`}
                    />
                  )}
                </div>
                <ScoreWrapper>{this.renderScore(project.id, 'period')}</ScoreWrapper>
                <ScoreWrapper>{this.renderScore(project.id, 'week')}</ScoreWrapper>
                <ScoreWrapper>{this.renderTrend(project.id)}</ScoreWrapper>
              </Fragment>
            ))}
          </StyledPanelTable>
        )}
      </SessionsRequest>
    );
  }
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
