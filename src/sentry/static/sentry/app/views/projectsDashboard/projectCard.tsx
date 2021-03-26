import React from 'react';
import styled from '@emotion/styled';

import {loadStatsForProject} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import BookmarkStar from 'app/components/projects/bookmarkStar';
import QuestionTooltip from 'app/components/questionTooltip';
import {t, tn} from 'app/locale';
import ProjectsStatsStore from 'app/stores/projectsStatsStore';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';
import {formatAbbreviatedNumber} from 'app/utils/formatters';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import Chart from './chart';
import Deploys from './deploys';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  hasProjectAccess: boolean;
};

class ProjectCard extends React.Component<Props> {
  componentDidMount() {
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

  get hasPerformance() {
    return this.props.organization.features.includes('performance-view');
  }

  render() {
    const {organization, project, hasProjectAccess} = this.props;
    const {id, stats, slug, transactionStats} = project;
    const totalErrors =
      stats !== undefined
        ? formatAbbreviatedNumber(stats.reduce((sum, [_, value]) => sum + value, 0))
        : '0';

    const totalTransactions =
      transactionStats !== undefined
        ? formatAbbreviatedNumber(
            transactionStats.reduce((sum, [_, value]) => sum + value, 0)
          )
        : '0';
    const zeroTransactions = totalTransactions === '0';
    const hasFirstEvent = Boolean(project.firstEvent || project.firstTransactionEvent);
    const projectLink = organization.features.includes('project-detail')
      ? `/organizations/${organization.slug}/projects/${slug}/?project=${id}`
      : `/organizations/${organization.slug}/issues/?project=${id}`;

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
                  displayName={
                    hasProjectAccess ? (
                      <Link to={projectLink}>
                        <strong>{slug}</strong>
                      </Link>
                    ) : (
                      <span>{slug}</span>
                    )
                  }
                />
                <BookmarkStar organization={organization} project={project} />
              </HeaderRow>
              <SummaryLinks>
                <Link
                  data-test-id="project-errors"
                  to={`/organizations/${organization.slug}/issues/?project=${project.id}`}
                >
                  {tn('%s error', '%s errors', totalErrors)}
                </Link>
                {this.hasPerformance && (
                  <React.Fragment>
                    <em>|</em>
                    <TransactionsLink
                      data-test-id="project-transactions"
                      to={`/organizations/${organization.slug}/performance/?project=${project.id}`}
                    >
                      {tn('%s transaction', '%s transactions', totalTransactions)}

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
                  </React.Fragment>
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
            <Deploys project={project} />
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

class ProjectCardContainer extends React.Component<ContainerProps, ContainerState> {
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
