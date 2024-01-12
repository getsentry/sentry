import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {fetchTagValues} from 'sentry/actionCreators/tags';
import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CreateAlertButton from 'sentry/components/createAlertButton';
import GlobalAppStoreConnectUpdateAlert from 'sentry/components/globalAppStoreConnectUpdateAlert';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import MissingProjectMembership from 'sentry/components/projects/missingProjectMembership';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import routeTitleGen from 'sentry/utils/routeTitle';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

import {ERRORS_BASIC_CHART_PERIODS} from './charts/projectErrorsBasicChart';
import ProjectScoreCards from './projectScoreCards/projectScoreCards';
import ProjectCharts from './projectCharts';
import ProjectFilters from './projectFilters';
import ProjectIssues from './projectIssues';
import ProjectLatestAlerts from './projectLatestAlerts';
import ProjectLatestReleases from './projectLatestReleases';
import ProjectQuickLinks from './projectQuickLinks';
import ProjectTeamAccess from './projectTeamAccess';

type RouteParams = {
  orgId: string;
  projectId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  loadingProjects: boolean;
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

type State = DeprecatedAsyncView['state'];

class ProjectDetail extends DeprecatedAsyncView<Props, State> {
  getTitle() {
    const {params, organization} = this.props;

    return routeTitleGen(t('Project %s', params.projectId), organization.slug, false);
  }

  componentDidMount() {
    super.componentDidMount();
    this.syncProjectWithSlug();
  }

  componentDidUpdate() {
    this.syncProjectWithSlug();
  }

  get project() {
    const {projects, params} = this.props;

    return projects.find(p => p.slug === params.projectId);
  }

  handleProjectChange = (selectedProjects: number[]) => {
    const {projects, router, location, organization} = this.props;

    const newlySelectedProject = projects.find(p => p.id === String(selectedProjects[0]));

    // if we change project in global header, we need to sync the project slug in the URL
    if (newlySelectedProject?.id) {
      router.replace(
        normalizeUrl({
          pathname: `/organizations/${organization.slug}/projects/${newlySelectedProject.slug}/`,
          query: {
            ...location.query,
            project: newlySelectedProject.id,
            environment: undefined,
          },
        })
      );
    }
  };

  handleSearch = (query: string) => {
    const {router, location} = this.props;
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        query,
      },
    });
  };

  tagValueLoader = (key: string, search: string) => {
    const {location, organization} = this.props;
    const {project: projectId} = location.query;

    return fetchTagValues({
      api: this.api,
      orgSlug: organization.slug,
      tagKey: key,
      search,
      projectIds: projectId ? [projectId] : undefined,
      endpointParams: location.query,
    });
  };

  syncProjectWithSlug() {
    const {router, location} = this.props;
    const projectId = this.project?.id;

    if (projectId && projectId !== location.query.project) {
      // if someone visits /organizations/sentry/projects/javascript/ (without ?project=XXX) we need to update URL and globalSelection with the right project ID
      updateProjects([Number(projectId)], router);
    }
  }

  onRetryProjects = () => {
    const {params} = this.props;
    fetchOrganizationDetails(this.api, params.orgId, true, false);
  };

  isProjectStabilized() {
    const {selection, location} = this.props;
    const projectId = this.project?.id;

    return (
      defined(projectId) &&
      projectId === location.query.project &&
      projectId === String(selection.projects[0])
    );
  }

  renderLoading() {
    return this.renderBody();
  }

  renderNoAccess(project: Project) {
    const {organization} = this.props;

    return (
      <Layout.Page>
        <MissingProjectMembership organization={organization} project={project} />
      </Layout.Page>
    );
  }

  renderProjectNotFound() {
    return (
      <Layout.Page withPadding>
        <LoadingError
          message={t('This project could not be found.')}
          onRetry={this.onRetryProjects}
        />
      </Layout.Page>
    );
  }

  renderBody() {
    const {organization, params, location, router, loadingProjects, selection} =
      this.props;
    const project = this.project;
    const {query} = location.query;
    const hasPerformance = organization.features.includes('performance-view');
    const hasDiscover = organization.features.includes('discover-basic');
    const hasTransactions = hasPerformance && project?.firstTransactionEvent;
    const isProjectStabilized = this.isProjectStabilized();
    const visibleCharts = ['chart1'];
    const hasSessions = project?.hasSessions ?? null;
    const hasOnlyBasicChart = !hasPerformance && !hasDiscover && !hasSessions;

    if (hasTransactions || hasSessions) {
      visibleCharts.push('chart2');
    }

    if (!loadingProjects && !project) {
      return this.renderProjectNotFound();
    }

    if (!loadingProjects && project && !project.hasAccess) {
      return this.renderNoAccess(project);
    }

    return (
      <PageFiltersContainer
        disablePersistence
        skipLoadLastUsed
        showAbsolute={!hasOnlyBasicChart}
      >
        <Layout.Page>
          <NoProjectMessage organization={organization}>
            <Layout.Header>
              <Layout.HeaderContent>
                <Breadcrumbs
                  crumbs={[
                    {
                      to: `/organizations/${params.orgId}/projects/`,
                      label: t('Projects'),
                    },
                    {label: t('Project Details')},
                  ]}
                />
                <Layout.Title>
                  {project ? (
                    <IdBadge
                      project={project}
                      avatarSize={28}
                      hideOverflow="100%"
                      disableLink
                      hideName
                    />
                  ) : null}
                  {project?.slug}
                </Layout.Title>
              </Layout.HeaderContent>

              <Layout.HeaderActions>
                <ButtonBar gap={1}>
                  <Button
                    size="sm"
                    to={
                      // if we are still fetching project, we can use project slug to build issue stream url and let the redirect handle it
                      project?.id
                        ? `/organizations/${params.orgId}/issues/?project=${project.id}`
                        : `/${params.orgId}/${params.projectId}`
                    }
                  >
                    {t('View All Issues')}
                  </Button>
                  <CreateAlertButton
                    size="sm"
                    organization={organization}
                    projectSlug={params.projectId}
                    aria-label={t('Create Alert')}
                  />
                  <Button
                    size="sm"
                    icon={<IconSettings />}
                    aria-label={t('Settings')}
                    to={`/settings/${params.orgId}/projects/${params.projectId}/`}
                  />
                </ButtonBar>
              </Layout.HeaderActions>
            </Layout.Header>

            <Layout.Body noRowGap>
              {project && <StyledGlobalEventProcessingAlert projects={[project]} />}
              <StyledGlobalAppStoreConnectUpdateAlert
                project={project}
                organization={organization}
              />
              <Layout.Main>
                <ProjectFiltersWrapper>
                  <ProjectFilters
                    query={query}
                    onSearch={this.handleSearch}
                    relativeDateOptions={
                      hasOnlyBasicChart
                        ? pick(DEFAULT_RELATIVE_PERIODS, ERRORS_BASIC_CHART_PERIODS)
                        : undefined
                    }
                    tagValueLoader={this.tagValueLoader}
                  />
                </ProjectFiltersWrapper>

                <ProjectScoreCards
                  organization={organization}
                  isProjectStabilized={isProjectStabilized}
                  selection={selection}
                  hasSessions={hasSessions}
                  hasTransactions={hasTransactions}
                  query={query}
                  project={project}
                  location={location}
                />
                {isProjectStabilized && (
                  <Fragment>
                    {visibleCharts.map((id, index) => (
                      <ProjectCharts
                        location={location}
                        organization={organization}
                        router={router}
                        key={`project-charts-${id}`}
                        chartId={id}
                        chartIndex={index}
                        projectId={project?.id}
                        hasSessions={hasSessions}
                        hasTransactions={!!hasTransactions}
                        visibleCharts={visibleCharts}
                        query={query}
                        project={project}
                      />
                    ))}
                    <ProjectIssues
                      organization={organization}
                      location={location}
                      projectId={selection.projects[0]}
                      query={query}
                      api={this.api}
                    />
                  </Fragment>
                )}
              </Layout.Main>
              <Layout.Side>
                <ProjectTeamAccess organization={organization} project={project} />
                <Feature features="incidents" organization={organization}>
                  <ProjectLatestAlerts
                    organization={organization}
                    projectSlug={params.projectId}
                    location={location}
                    isProjectStabilized={isProjectStabilized}
                  />
                </Feature>
                <ProjectLatestReleases
                  organization={organization}
                  projectSlug={params.projectId}
                  projectId={project?.id}
                  location={location}
                  isProjectStabilized={isProjectStabilized}
                />
                <ProjectQuickLinks
                  organization={organization}
                  project={project}
                  location={location}
                />
              </Layout.Side>
            </Layout.Body>
          </NoProjectMessage>
        </Layout.Page>
      </PageFiltersContainer>
    );
  }
}

const ProjectFiltersWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }
`;

const StyledGlobalAppStoreConnectUpdateAlert = styled(GlobalAppStoreConnectUpdateAlert)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }
`;

StyledGlobalAppStoreConnectUpdateAlert.defaultProps = {
  Wrapper: p => <Layout.Main fullWidth {...p} />,
};

export default withProjects(withPageFilters(ProjectDetail));
