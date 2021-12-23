import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import round from 'lodash/round';

import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import {DateTimeObject} from 'sentry/components/charts/utils';
import IdBadge from 'sentry/components/idBadge';
import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import PanelTable from 'sentry/components/panels/panelTable';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project, SessionApiResponse, SessionField} from 'sentry/types';
import {getCrashFreeRate} from 'sentry/utils/sessions';
import {Color} from 'sentry/utils/theme';
import {displayCrashFreePercent} from 'sentry/views/releases/utils';

import {groupByTrend} from './utils';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
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
            ...getParams(datetime),
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

    return getCrashFreeRate(projectGroups, SessionField.SESSIONS);
  }

  getTrend(projectId: number): number | null {
    const periodScore = this.getScore(projectId, 'period');
    const weekScore = this.getScore(projectId, 'week');

    if (periodScore === null || weekScore === null) {
      return null;
    }

    return weekScore - periodScore;
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
      <SubText color={trend >= 0 ? 'green300' : 'red300'}>
        {`${round(Math.abs(trend), 3)}\u0025`}
        <PaddedIconArrow direction={trend >= 0 ? 'up' : 'down'} size="xs" />
      </SubText>
    );
  }

  renderBody() {
    const {projects, period} = this.props;

    const sortedProjects = projects
      .map(project => ({project, trend: this.getTrend(Number(project.id)) ?? 0}))
      .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend));

    const groupedProjects = groupByTrend(sortedProjects);

    return (
      <StyledPanelTable
        isEmpty={projects.length === 0}
        emptyMessage={t('No Projects With Release Health Enabled')}
        emptyAction={
          <Button
            size="small"
            external
            href="https://docs.sentry.io/platforms/dotnet/guides/nlog/configuration/releases/#release-health"
          >
            {t('Learn More')}
          </Button>
        }
        headers={[
          t('Project'),
          <RightAligned key="last">{tct('Last [period]', {period})}</RightAligned>,
          <RightAligned key="curr">{t('Last 7 Days')}</RightAligned>,
          <RightAligned key="diff">{t('Difference')}</RightAligned>,
        ]}
      >
        {groupedProjects.map(({project}) => (
          <Fragment key={project.id}>
            <ProjectBadgeContainer>
              <ProjectBadge avatarSize={18} project={project} />
            </ProjectBadgeContainer>

            <ScoreWrapper>{this.renderScore(project.id, 'period')}</ScoreWrapper>
            <ScoreWrapper>{this.renderScore(project.id, 'week')}</ScoreWrapper>
            <ScoreWrapper>{this.renderTrend(project.id)}</ScoreWrapper>
          </Fragment>
        ))}
      </StyledPanelTable>
    );
  }
}

export default TeamStability;

const StyledPanelTable = styled(PanelTable)<{isEmpty: boolean}>`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.2fr;
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  box-shadow: unset;

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

const SubText = styled('div')<{color: Color}>`
  color: ${p => p.theme[p.color]};
`;

const ProjectBadgeContainer = styled('div')`
  display: flex;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;
