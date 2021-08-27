import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {updateProjects} from 'app/actionCreators/globalSelection';
import {fetchTagValues} from 'app/actionCreators/tags';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Breadcrumbs from 'app/components/breadcrumbs';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import CreateAlertButton from 'app/components/createAlertButton';
import GlobalAppStoreConnectUpdateAlert from 'app/components/globalAppStoreConnectUpdateAlert';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import IdBadge from 'app/components/idBadge';
import * as Layout from 'app/components/layouts/thirds';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import MissingProjectMembership from 'app/components/projects/missingProjectMembership';
import TextOverflow from 'app/components/textOverflow';
import {IconSettings, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Project, SessionApiResponse} from 'app/types';
import {defined} from 'app/utils';
import routeTitleGen from 'app/utils/routeTitle';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withProjects from 'app/utils/withProjects';
import AsyncView from 'app/views/asyncView';

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
  organization: Organization;
  projects: Project[];
  loadingProjects: boolean;
  selection: GlobalSelection;
};

type State = AsyncView['state'] & {
  hasSessions: boolean | null;
};

class ProjectDetail extends AsyncView<Props, State> {
  getTitle() {
    const {params} = this.props;

    return routeTitleGen(t('Project %s', params.projectId), params.orgId, false);
  }

  componentDidMount() {
    this.syncProjectWithSlug();
    if (this.props.location.query.project) {
      this.fetchSessionsExistence();
    }
  }

  componentDidUpdate(prevProps: Props) {
    this.syncProjectWithSlug();

    if (prevProps.location.query.project !== this.props.location.query.project) {
      this.fetchSessionsExistence();
    }
  }

  get project() {
    const {projects, params} = this.props;

    return projects.find(p => p.slug === params.projectId);
  }

  async fetchSessionsExistence() {
    const {organization, location} = this.props;
    const {project: projectId, query} = location.query;

    if (!projectId) {
      return;
    }

    this.setState({
      hasSessions: null,
    });

    try {
      const response: SessionApiResponse = await this.api.requestPromise(
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            project: projectId,
            field: 'sum(session)',
            statsPeriod: '90d',
            interval: '1d',
            query,
          },
        }
      );
      this.setState({
        hasSessions: response.groups[0].totals['sum(session)'] > 0,
      });
    } catch {
      // do nothing
    }
  }

  handleProjectChange = (selectedProjects: number[]) => {
    const {projects, router, location, organization} = this.props;

    const newlySelectedProject = projects.find(p => p.id === String(selectedProjects[0]));

    // if we change project in global header, we need to sync the project slug in the URL
    if (newlySelectedProject?.id) {
      router.replace({
        pathname: `/organizations/${organization.slug}/projects/${newlySelectedProject.slug}/`,
        query: {
          ...location.query,
          project: newlySelectedProject.id,
          environment: undefined,
        },
      });
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

    return fetchTagValues(
      this.api,
      organization.slug,
      key,
      search,
      projectId ? [projectId] : null,
      location.query
    );
  };

  syncProjectWithSlug() {
    const {router, location} = this.props;
    const projectId = this.project?.id;

    if (projectId && projectId !== location.query.project) {
      // if someone visits /organizations/sentry/projects/javascript/ (without ?project=XXX) we need to update URL and globalSelection with the right project ID
      updateProjects([Number(projectId)], router);
    }
  }

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
      <PageContent>
        <MissingProjectMembership
          organization={organization}
          projectSlug={project.slug}
        />
      </PageContent>
    );
  }

  renderProjectNotFound() {
    return (
      <PageContent>
        <Alert type="error" icon={<IconWarning />}>
          {t('This project could not be found.')}
        </Alert>
      </PageContent>
    );
  }

  renderBody() {
    const {organization, params, location, router, loadingProjects, selection} =
      this.props;
    const project = this.project;
    const {hasSessions} = this.state;
    const {query} = location.query;
    const hasPerformance = organization.features.includes('performance-view');
    const hasTransactions = hasPerformance && project?.firstTransactionEvent;
    const isProjectStabilized = this.isProjectStabilized();
    const visibleCharts = ['chart1'];

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
      <GlobalSelectionHeader
        disableMultipleProjectSelection
        skipLoadLastUsed
        onUpdateProjects={this.handleProjectChange}
      >
        <LightWeightNoProjectMessage organization={organization}>
          <StyledPageContent>
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
                  <TextOverflow>
                    {project && (
                      <IdBadge
                        project={project}
                        avatarSize={28}
                        displayName={params.projectId}
                        disableLink
                      />
                    )}
                  </TextOverflow>
                </Layout.Title>
              </Layout.HeaderContent>

              <Layout.HeaderActions>
                <ButtonBar gap={1}>
                  <Button
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
                    organization={organization}
                    projectSlug={params.projectId}
                  />
                  <Button
                    icon={<IconSettings />}
                    label={t('Settings')}
                    to={`/settings/${params.orgId}/projects/${params.projectId}/`}
                  />
                </ButtonBar>
              </Layout.HeaderActions>
            </Layout.Header>

            <Layout.Body>
              <StyledSdkUpdatesAlert />
              <StyledGlobalAppStoreConnectUpdateAlert
                project={project}
                organization={organization}
              />
              <Layout.Main>
                <Feature features={['semver']} organization={organization}>
                  <ProjectFiltersWrapper>
                    <ProjectFilters
                      query={query}
                      onSearch={this.handleSearch}
                      tagValueLoader={this.tagValueLoader}
                    />
                  </ProjectFiltersWrapper>
                </Feature>

                <ProjectScoreCards
                  organization={organization}
                  isProjectStabilized={isProjectStabilized}
                  selection={selection}
                  hasSessions={hasSessions}
                  hasTransactions={hasTransactions}
                  query={query}
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
                <Feature features={['incidents']} organization={organization}>
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
          </StyledPageContent>
        </LightWeightNoProjectMessage>
      </GlobalSelectionHeader>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const ProjectFiltersWrapper = styled('div')`
  margin-bottom: ${space(2)};
  display: grid;
`;

const StyledSdkUpdatesAlert = styled(GlobalSdkUpdateAlert)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
  }
`;

StyledSdkUpdatesAlert.defaultProps = {
  Wrapper: p => <Layout.Main fullWidth {...p} />,
};

const StyledGlobalAppStoreConnectUpdateAlert = styled(GlobalAppStoreConnectUpdateAlert)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
  }
`;

StyledGlobalAppStoreConnectUpdateAlert.defaultProps = {
  Wrapper: p => <Layout.Main fullWidth {...p} />,
};

export default withProjects(withGlobalSelection(ProjectDetail));
