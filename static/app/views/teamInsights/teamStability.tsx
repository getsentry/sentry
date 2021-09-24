import {Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import round from 'lodash/round';

import AsyncComponent from 'app/components/asyncComponent';
import {DateTimeObject} from 'app/components/charts/utils';
import IdBadge from 'app/components/idBadge';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import PanelTable from 'app/components/panels/panelTable';
import Placeholder from 'app/components/placeholder';
import {IconArrow} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, SessionApiResponse, SessionField} from 'app/types';
import {getCrashFreeRate} from 'app/utils/sessions';
import type {Color} from 'app/utils/theme';
import {displayCrashFreePercent} from 'app/views/releases/utils';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  comparisonPeriod: string;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  /** Currently selected date range */
  periodSessions: SessionApiResponse | null;
  /** Last 7d or last 1d */
  recentSessions: SessionApiResponse | null;
};

class TeamStability extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      periodSessions: null,
      recentSessions: null,
    };
  }

  getEndpoints() {
    const {organization, comparisonPeriod, start, end, period, utc, projects} =
      this.props;

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
        'recentSessions',
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            ...commonQuery,
            statsPeriod: comparisonPeriod,
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

  getScore(projectId: number, dataset: 'recent' | 'period'): number | null {
    const {periodSessions, recentSessions} = this.state;
    const sessions = dataset === 'recent' ? recentSessions : periodSessions;
    const projectGroups = sessions?.groups.filter(
      group => group.by.project === projectId
    );

    return getCrashFreeRate(projectGroups, SessionField.SESSIONS);
  }

  getTrend(projectId: number): number | null {
    const periodScore = this.getScore(projectId, 'period');
    const weekScore = this.getScore(projectId, 'recent');

    if (periodScore === null || weekScore === null) {
      return null;
    }

    return weekScore - periodScore;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderScore(projectId: string, dataset: 'recent' | 'period') {
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
    const {projects, period, comparisonPeriod} = this.props;

    return (
      <StyledPanelTable
        headers={[
          t('Project'),
          <RightAligned key="last">{tct('Last [period]', {period})}</RightAligned>,
          <RightAligned key="curr">
            {comparisonPeriod === '1d' ? t('Last 24h') : t('Last Week')}
          </RightAligned>,
          <RightAligned key="diff">{t('Difference')}</RightAligned>,
        ]}
      >
        {projects.map(project => (
          <Fragment key={project.id}>
            <ProjectBadgeContainer>
              <ProjectBadge avatarSize={18} project={project} />
            </ProjectBadgeContainer>

            <ScoreWrapper>{this.renderScore(project.id, 'period')}</ScoreWrapper>
            <ScoreWrapper>{this.renderScore(project.id, 'recent')}</ScoreWrapper>
            <ScoreWrapper>{this.renderTrend(project.id)}</ScoreWrapper>
          </Fragment>
        ))}
      </StyledPanelTable>
    );
  }
}

export default TeamStability;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 0.2fr 0.2fr 0.2fr;
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
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
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme[p.color]};
`;

const ProjectBadgeContainer = styled('div')`
  display: flex;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;
