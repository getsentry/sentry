import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import round from 'lodash/round';

import {loadStatsForProject} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import AsyncComponent from 'app/components/asyncComponent';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import BookmarkStar from 'app/components/projects/bookmarkStar';
import QuestionTooltip from 'app/components/questionTooltip';
import ScoreCard, {HeaderTitle, StyledPanel} from 'app/components/scoreCard';
import {IconArrow} from 'app/icons';
import {t, tn} from 'app/locale';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import space from 'app/styles/space';
import {Organization, Project, SessionApiResponse} from 'app/types';
import {defined, percent} from 'app/utils';
import {callIfFunction} from 'app/utils/callIfFunction';
import {formatAbbreviatedNumber} from 'app/utils/formatters';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import MissingReleasesButtons, {
  StyledButtonBar,
} from 'app/views/projectDetail/missingFeatureButtons/missingReleasesButtons';
import {displayCrashFreePercent, getCrashFreePercent} from 'app/views/releases/utils';

import Chart from './chart';
import Deploys, {DeployRows, GetStarted, TextOverflow} from './deploys';

type Props = AsyncComponent['props'] & {
  api: Client;
  organization: Organization;
  project: Project;
  hasProjectAccess: boolean;
};

type State = AsyncComponent['state'] & {
  hasSessions: boolean | null;
  currentSessions: SessionApiResponse | null;
  previousSessions: SessionApiResponse | null;
};

class ProjectCard extends AsyncComponent<Props, State> {
  async componentDidMount() {
    const {organization, project, api} = this.props;

    // fetch project stats
    loadStatsForProject(api, project.id, {
      orgId: organization.slug,
      projectId: project.id,
      query: {
        transactionStats: this.hasPerformance ? '1' : undefined,
      },
    });
  }

  calculateCrashFree(data?: SessionApiResponse | null) {
    if (!data) {
      return undefined;
    }

    const totalSessions = data.groups.reduce(
      (acc, group) => acc + group.totals['sum(session)'],
      0
    );

    const crashedSessions = data.groups.find(
      group => group.by['session.status'] === 'crashed'
    )?.totals['sum(session)'];

    if (totalSessions === 0 || !defined(totalSessions) || !defined(crashedSessions)) {
      return undefined;
    }

    const crashedSessionsPercent = percent(crashedSessions, totalSessions);

    return getCrashFreePercent(100 - crashedSessionsPercent);
  }

  get hasPerformance() {
    return this.props.organization.features.includes('performance-view');
  }

  isProjectStabilized() {
    const {project} = this.props;
    const projectId = project?.id;

    return defined(projectId) && projectId === project.id;
  }

  get score() {
    const {currentSessions} = this.state;

    return this.calculateCrashFree(currentSessions);
  }

  get trend() {
    const {previousSessions} = this.state;

    const previousScore = this.calculateCrashFree(previousSessions);

    if (!defined(this.score) || !defined(previousScore)) {
      return undefined;
    }

    return round(this.score - previousScore, 3);
  }

  get trendStatus(): React.ComponentProps<typeof ScoreCard>['trendStatus'] {
    if (!this.trend) {
      return undefined;
    }

    return this.trend > 0 ? 'good' : 'bad';
  }

  renderScore() {
    const {loading} = this.state;

    if (loading || !defined(this.score)) {
      return '\u2014';
    }

    return displayCrashFreePercent(this.score);
  }

  renderTrend() {
    const {loading} = this.state;

    if (loading || !defined(this.score) || !defined(this.trend)) {
      return null;
    }

    return (
      <div>
        {this.trend >= 0 ? (
          <IconArrow direction="up" size="xs" />
        ) : (
          <IconArrow direction="down" size="xs" />
        )}
        {`${formatAbbreviatedNumber(Math.abs(this.trend))}\u0025`}
      </div>
    );
  }

  renderMissingFeatureCard() {
    const {organization} = this.props;
    return (
      <ScoreCard
        title={t('Crash Free Sessions')}
        score={<MissingReleasesButtons organization={organization} health />}
      />
    );
  }

  render() {
    const {organization, project, hasProjectAccess} = this.props;
    const {stats, slug, transactionStats} = project;
    const totalErrors = stats?.reduce((sum, [_, value]) => sum + value, 0) ?? 0;
    const totalTransactions =
      transactionStats?.reduce((sum, [_, value]) => sum + value, 0) ?? 0;
    const zeroTransactions = totalTransactions === 0;
    const hasFirstEvent = Boolean(project.firstEvent || project.firstTransactionEvent);

    const hasSessions = false;

    return (
      <div data-test-id={slug}>
        {stats ? (
          <StyledProjectCard>
            <CardHeader>
              <HeaderRow>
                <StyledIdBadge
                  project={project}
                  avatarSize={18}
                  hideOverflow
                  disableLink={!hasProjectAccess}
                />
                <BookmarkStar organization={organization} project={project} />
              </HeaderRow>
              <SummaryLinks>
                <Link
                  data-test-id="project-errors"
                  to={`/organizations/${organization.slug}/issues/?project=${project.id}`}
                >
                  {tn('%s Error', '%s Errors', formatAbbreviatedNumber(totalErrors))}
                </Link>
                {this.hasPerformance && (
                  <Fragment>
                    <em>|</em>
                    <TransactionsLink
                      data-test-id="project-transactions"
                      to={`/organizations/${organization.slug}/performance/?project=${project.id}`}
                    >
                      {tn(
                        '%s Transaction',
                        '%s Transactions',
                        formatAbbreviatedNumber(totalTransactions)
                      )}
                      {zeroTransactions && (
                        <QuestionTooltip
                          title={t(
                            'Click here to learn more about performance monitoring'
                          )}
                          position="top"
                          size="xs"
                        />
                      )}
                    </TransactionsLink>
                  </Fragment>
                )}
              </SummaryLinks>
            </CardHeader>
            <ChartContainer>
              <Chart
                firstEvent={hasFirstEvent}
                stats={stats}
                transactionStats={transactionStats}
              />
            </ChartContainer>
            <FooterWrapper>
              <ScoreCardWrapper>
                {hasSessions ? (
                  <ScoreCard
                    title={t('Crash Free Sessions')}
                    score={this.renderScore()}
                    trend={this.renderTrend()}
                    trendStatus={this.trendStatus}
                  />
                ) : (
                  this.renderMissingFeatureCard()
                )}
              </ScoreCardWrapper>
              <DeploysWrapper>
                <ReleaseTitle>{'Latest Releases'}</ReleaseTitle>
                <Deploys project={project} shorten />
              </DeploysWrapper>
            </FooterWrapper>
          </StyledProjectCard>
        ) : (
          <LoadingCard />
        )}
      </div>
    );
  }
}

type ContainerProps = {
  api: Client;
  project: Project;
  organization: Organization;
  hasProjectAccess: boolean;
};

type ContainerState = {
  projectDetails: Project | null;
};

class ProjectCardContainer extends Component<ContainerProps, ContainerState> {
  state = this.getInitialState();

  getInitialState(): ContainerState {
    const {project} = this.props;
    const initialState = ProjectsStatsStore.getInitialState() || {};
    return {
      projectDetails: initialState[project.slug] || null,
    };
  }

  componentWillUnmount() {
    this.listeners.forEach(callIfFunction);
  }

  listeners = [
    ProjectsStatsStore.listen(itemsBySlug => {
      this.onProjectStoreUpdate(itemsBySlug);
    }, undefined),
  ];

  onProjectStoreUpdate(itemsBySlug: typeof ProjectsStatsStore['itemsBySlug']) {
    const {project} = this.props;

    // Don't update state if we already have stats
    if (!itemsBySlug[project.slug]) {
      return;
    }
    if (itemsBySlug[project.slug] === this.state.projectDetails) {
      return;
    }

    this.setState({
      projectDetails: itemsBySlug[project.slug],
    });
  }

  render() {
    const {project, ...props} = this.props;
    const {projectDetails} = this.state;
    return (
      <ProjectCard
        {...props}
        project={{
          ...project,
          ...(projectDetails || {}),
        }}
      />
    );
  }
}

const ChartContainer = styled('div')`
  position: relative;
  background: ${p => p.theme.backgroundSecondary};
`;

const CardHeader = styled('div')`
  margin: ${space(1.5)} ${space(2)};
`;

const HeaderRow = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  justify-content: space-between;
  align-items: center;
`;

const StyledProjectCard = styled('div')`
  background-color: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLight};
`;

const FooterWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  div {
    border: none;
    box-shadow: none;
    font-size: ${p => p.theme.fontSizeMedium};
    padding: 0;
  }
  ${StyledButtonBar} {
    a {
      background-color: ${p => p.theme.background};
      border: 1px solid ${p => p.theme.border};
      border-radius: ${p => p.theme.borderRadius};
      color: ${p => p.theme.gray500};
    }
  }
`;

const ScoreCardWrapper = styled('div')`
  margin: ${space(2)} 0 0 ${space(2)};
  ${StyledPanel} {
    min-height: auto;
  }
  ${HeaderTitle} {
    color: ${p => p.theme.gray300};
    font-weight: 600;
  }
`;

const DeploysWrapper = styled('div')`
  margin-top: ${space(2)};
  ${GetStarted} {
    display: block;
    height: 100%;
  }
  ${TextOverflow} {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-column-gap: ${space(1)};
    div {
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    a {
      display: grid;
    }
  }
  ${DeployRows} {
    grid-template-columns: 2fr auto;
    margin-right: ${space(2)};
    height: auto;
    svg {
      display: none;
    }
  }
`;

const ReleaseTitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-weight: 600;
`;

const LoadingCard = styled('div')`
  border: 1px solid transparent;
  background-color: ${p => p.theme.backgroundSecondary};
  height: 334px;
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;

const SummaryLinks = styled('div')`
  display: flex;
  align-items: center;

  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};

  /* Need to offset for the project icon and margin */
  margin-left: 26px;

  a {
    color: ${p => p.theme.formText};
    :hover {
      color: ${p => p.theme.subText};
    }
  }
  em {
    font-style: normal;
    margin: 0 ${space(0.5)};
  }
`;

const TransactionsLink = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;

  > span {
    margin-left: ${space(0.5)};
  }
`;

export {ProjectCard};
export default withOrganization(withApi(ProjectCardContainer));
