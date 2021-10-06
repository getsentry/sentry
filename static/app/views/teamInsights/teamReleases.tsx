import {Fragment} from 'react';
import styled from '@emotion/styled';
import groupBy from 'lodash/groupBy';
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
import {Organization, Project, Release} from 'app/types';
import {Color} from 'app/utils/theme';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  /** weekly selected date range */
  periodReleases: Release[] | null;
  /** Locked to last 7 days */
  weekReleases: Release[] | null;
};

class TeamReleases extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      weekReleases: null,
      periodReleases: null,
    };
  }

  getEndpoints() {
    const {organization, start, end, period, utc, projects} = this.props;

    const datetime = {start, end, period, utc};
    const commonQuery = {
      environment: [],
      project: projects.map(p => p.id),
    };

    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      [
        'periodReleases',
        `/organizations/${organization.slug}/releases/`,
        {
          query: {
            ...commonQuery,
            ...getParams(datetime),
          },
        },
      ],
      [
        'weekReleases',
        `/organizations/${organization.slug}/releases/`,
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

  getReleaseCount(projectId: number, dataset: 'week' | 'period'): number | null {
    const {periodReleases, weekReleases} = this.state;
    const releasesPeriod = dataset === 'week' ? weekReleases : periodReleases;

    const releaseCount: any[] = [];
    releasesPeriod?.forEach(release =>
      release.projects.map(project => {
        releaseCount.push({id: project.id, version: release.version});
      })
    );

    const projectGroup = Object.fromEntries(
      Object.entries(groupBy(releaseCount, 'id')).map(([key, val]) => [key, val])
    );
    const count = projectGroup[projectId] ? projectGroup[projectId].length : 0;

    return count;
  }

  getTrend(projectId: number): number | null {
    const periodCount = this.getReleaseCount(projectId, 'period');
    const weekCount = this.getReleaseCount(projectId, 'week');

    if (periodCount === null || weekCount === null) {
      return null;
    }

    return weekCount - periodCount;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderReleaseCount(projectId: string, dataset: 'week' | 'period') {
    const {loading} = this.state;

    if (loading) {
      return (
        <div>
          <Placeholder width="80px" height="25px" />
        </div>
      );
    }

    const count = this.getReleaseCount(Number(projectId), dataset);

    if (count === null) {
      return '\u2014';
    }

    return count;
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
        {`${round(Math.abs(trend), 3)}`}
        <PaddedIconArrow direction={trend >= 0 ? 'up' : 'down'} size="xs" />
      </SubText>
    );
  }

  renderBody() {
    const {projects, period} = this.props;

    return (
      <StyledPanelTable
        isEmpty={projects.length === 0}
        headers={[
          t('Project'),
          <RightAligned key="last">{tct('Last [period]', {period})}</RightAligned>,
          <RightAligned key="curr">{t('This Week')}</RightAligned>,
          <RightAligned key="diff">{t('Difference')}</RightAligned>,
        ]}
      >
        {projects.map(project => (
          <Fragment key={project.id}>
            <ProjectBadgeContainer>
              <ProjectBadge avatarSize={18} project={project} />
            </ProjectBadgeContainer>

            <ScoreWrapper>{this.renderReleaseCount(project.id, 'period')}</ScoreWrapper>
            <ScoreWrapper>{this.renderReleaseCount(project.id, 'week')}</ScoreWrapper>
            <ScoreWrapper>{this.renderTrend(project.id)}</ScoreWrapper>
          </Fragment>
        ))}
      </StyledPanelTable>
    );
  }
}

export default TeamReleases;

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
  color: ${p => p.theme[p.color]};
`;

const ProjectBadgeContainer = styled('div')`
  display: flex;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;
