import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import round from 'lodash/round';

import {loadStatsForProject} from 'sentry/actionCreators/projects';
import {Client} from 'sentry/api';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import BookmarkStar from 'sentry/components/projects/bookmarkStar';
import QuestionTooltip from 'sentry/components/questionTooltip';
import ScoreCard, {
  HeaderTitle,
  Score,
  ScorePanel,
  ScoreWrapper,
  Trend,
} from 'sentry/components/scoreCard';
import {releaseHealth} from 'sentry/data/platformCategories';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStatsStore from 'sentry/stores/projectsStatsStore';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import MissingReleasesButtons from 'sentry/views/projectDetail/missingFeatureButtons/missingReleasesButtons';
import {
  CRASH_FREE_DECIMAL_THRESHOLD,
  displayCrashFreePercent,
} from 'sentry/views/releases/utils';

import Chart from './chart';
import Deploys, {DeployRows, GetStarted, TextOverflow} from './deploys';

type Props = {
  api: Client;
  hasProjectAccess: boolean;
  organization: Organization;
  project: Project;
};

class ProjectCard extends Component<Props> {
  componentDidMount() {
    const {organization, project, api} = this.props;

    // fetch project stats
    loadStatsForProject(api, project.id, {
      orgId: organization.slug,
      projectId: project.id,
      query: {
        transactionStats: this.hasPerformance ? '1' : undefined,
        sessionStats: '1',
      },
    });
  }

  get hasPerformance() {
    return this.props.organization.features.includes('performance-view');
  }

  get crashFreeTrend() {
    const {currentCrashFreeRate, previousCrashFreeRate} =
      this.props.project.sessionStats || {};
    if (!defined(currentCrashFreeRate) || !defined(previousCrashFreeRate)) {
      return undefined;
    }

    return round(
      currentCrashFreeRate - previousCrashFreeRate,
      currentCrashFreeRate > CRASH_FREE_DECIMAL_THRESHOLD ? 3 : 0
    );
  }

  renderMissingFeatureCard() {
    const {organization, project} = this.props;
    if (project.platform && releaseHealth.includes(project.platform)) {
      return (
        <ScoreCard
          title={t('Crash Free Sessions')}
          score={<MissingReleasesButtons organization={organization} health />}
        />
      );
    }

    return (
      <ScoreCard
        title={t('Crash Free Sessions')}
        score={
          <NotAvailable>
            {t('Not Available')}
            <QuestionTooltip
              title={t('Release Health is not yet supported on this platform.')}
              size="xs"
            />
          </NotAvailable>
        }
      />
    );
  }

  renderTrend() {
    const {currentCrashFreeRate} = this.props.project.sessionStats || {};

    if (!defined(currentCrashFreeRate) || !defined(this.crashFreeTrend)) {
      return null;
    }

    return (
      <div>
        {this.crashFreeTrend >= 0 ? (
          <IconArrow direction="up" size="xs" />
        ) : (
          <IconArrow direction="down" size="xs" />
        )}
        {`${formatAbbreviatedNumber(Math.abs(this.crashFreeTrend))}\u0025`}
      </div>
    );
  }

  render() {
    const {organization, project, hasProjectAccess} = this.props;
    const {stats, slug, transactionStats, sessionStats} = project;
    const {hasHealthData, currentCrashFreeRate} = sessionStats || {};
    const totalErrors = stats?.reduce((sum, [_, value]) => sum + value, 0) ?? 0;
    const totalTransactions =
      transactionStats?.reduce((sum, [_, value]) => sum + value, 0) ?? 0;
    const zeroTransactions = totalTransactions === 0;
    const hasFirstEvent = Boolean(project.firstEvent || project.firstTransactionEvent);

    return (
      <div data-test-id={slug}>
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
              {stats ? (
                <Fragment>
                  <Link
                    data-test-id="project-errors"
                    to={`/organizations/${organization.slug}/issues/?project=${project.id}`}
                  >
                    {t('errors: %s', formatAbbreviatedNumber(totalErrors))}
                  </Link>
                  {this.hasPerformance && (
                    <Fragment>
                      <em>|</em>
                      <TransactionsLink
                        data-test-id="project-transactions"
                        to={`/organizations/${organization.slug}/performance/?project=${project.id}`}
                      >
                        {t(
                          'transactions: %s',
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
                </Fragment>
              ) : (
                <SummaryLinkPlaceholder />
              )}
            </SummaryLinks>
          </CardHeader>
          <ChartContainer>
            {stats ? (
              <Chart
                firstEvent={hasFirstEvent}
                stats={stats}
                transactionStats={transactionStats}
              />
            ) : (
              <Placeholder height="150px" />
            )}
          </ChartContainer>
          <FooterWrapper>
            <ScoreCardWrapper>
              {!stats ? (
                <Fragment>
                  <ReleaseTitle>{t('Crash Free Sessions')}</ReleaseTitle>
                  <FooterPlaceholder />
                </Fragment>
              ) : hasHealthData ? (
                <ScoreCard
                  title={t('Crash Free Sessions')}
                  score={
                    defined(currentCrashFreeRate)
                      ? displayCrashFreePercent(currentCrashFreeRate)
                      : '\u2014'
                  }
                  trend={this.renderTrend()}
                  trendStatus={
                    this.crashFreeTrend
                      ? this.crashFreeTrend > 0
                        ? 'good'
                        : 'bad'
                      : undefined
                  }
                />
              ) : (
                this.renderMissingFeatureCard()
              )}
            </ScoreCardWrapper>
            <DeploysWrapper>
              <ReleaseTitle>{t('Latest Deploys')}</ReleaseTitle>
              {stats ? <Deploys project={project} shorten /> : <FooterPlaceholder />}
            </DeploysWrapper>
          </FooterWrapper>
        </StyledProjectCard>
      </div>
    );
  }
}

type ContainerProps = {
  api: Client;
  hasProjectAccess: boolean;
  organization: Organization;
  project: Project;
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

  ${p => p.theme.text.cardTitle};
  color: ${p => p.theme.headingColor};
`;

const StyledProjectCard = styled('div')`
  background-color: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLight};
  min-height: 330px;
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
`;

const ScoreCardWrapper = styled('div')`
  margin: ${space(2)} 0 0 ${space(2)};
  ${ScorePanel} {
    min-height: auto;
  }
  ${HeaderTitle} {
    color: ${p => p.theme.gray300};
    font-weight: 600;
  }
  ${ScoreWrapper} {
    flex-direction: column;
    align-items: flex-start;
  }
  ${Score} {
    font-size: 28px;
  }
  ${Trend} {
    margin-left: 0;
    margin-top: ${space(0.5)};
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

const NotAvailable = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: normal;
  display: grid;
  grid-template-columns: auto auto;
  gap: ${space(0.5)};
  align-items: center;
`;

const SummaryLinkPlaceholder = styled(Placeholder)`
  height: 15px;
  width: 180px;
  margin-top: ${space(0.75)};
  margin-bottom: ${space(0.5)};
`;

const FooterPlaceholder = styled(Placeholder)`
  height: 40px;
  width: auto;
  margin-right: ${space(2)};
`;

export {ProjectCard};
export default withOrganization(withApi(ProjectCardContainer));
