import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {fetchTagValues} from 'sentry/actionCreators/tags';
import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import CreateAlertButton from 'sentry/components/createAlertButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import MissingProjectMembership from 'sentry/components/projects/missingProjectMembership';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import routeTitleGen from 'sentry/utils/routeTitle';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

import {ERRORS_BASIC_CHART_PERIODS} from './charts/projectErrorsBasicChart';
import ProjectScoreCards from './projectScoreCards/projectScoreCards';
import ProjectCharts from './projectCharts';
import ProjectFilters from './projectFilters';
import ProjectIssues from './projectIssues';
import ProjectLatestAlerts from './projectLatestAlerts';
import ProjectLatestReleases from './projectLatestReleases';
import ProjectQuickLinks from './projectQuickLinks';
import ProjectTeamAccess from './projectTeamAccess';

export default function ProjectDetail() {
  const api = useApi();
  const params = useParams<{orgId: string; projectId: string}>();
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const router = useRouter();
  const {projects, fetching: loadingProjects} = useProjects();
  const {selection} = usePageFilters();
  const project = projects.find(p => p.slug === params.projectId);
  const query = decodeScalar(location.query.query, '');
  const projectQueryParam = decodeScalar(location.query.project);
  const hasPerformance = organization.features.includes('performance-view');
  const hasDiscover = organization.features.includes('discover-basic');
  const hasTransactions = hasPerformance && project?.firstTransactionEvent;
  const projectId = project?.id;
  const isProjectStabilized =
    defined(project?.id) &&
    project.id === projectQueryParam &&
    project.id === String(selection.projects[0]);
  const hasSessions = project?.hasSessions ?? null;
  const hasOnlyBasicChart = !hasPerformance && !hasDiscover && !hasSessions;
  const title = routeTitleGen(
    t('Project %s', params.projectId),
    organization.slug,
    false
  );
  const visibleCharts = useMemo(() => {
    if (hasTransactions || hasSessions) {
      return ['chart1', 'chart2'];
    }
    return ['chart1'];
  }, [hasTransactions, hasSessions]);

  const onRetryProjects = useCallback(() => {
    fetchOrganizationDetails(api, params.orgId);
  }, [api, params.orgId]);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            query: searchQuery,
          },
        },
        {replace: true}
      );
    },
    [navigate, location.query, location.pathname]
  );

  const tagValueLoader = useCallback(
    (key: string, search: string) => {
      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: key,
        search,
        projectIds: projectQueryParam ? [projectQueryParam] : undefined,
        endpointParams: location.query,
      });
    },
    [api, organization.slug, location.query, projectQueryParam]
  );

  useEffect(() => {
    function syncProjectWithSlug() {
      if (projectId && projectId !== projectQueryParam) {
        // if someone visits /organizations/sentry/projects/javascript/ (without ?project=XXX) we need to update URL and globalSelection with the right project ID
        updateProjects([Number(projectId)], router);
      }
    }
    syncProjectWithSlug();
  }, [projectQueryParam, router, projectId]);

  if (!loadingProjects && !project) {
    return (
      <Layout.Page withPadding>
        <LoadingError
          message={t('This project could not be found.')}
          onRetry={onRetryProjects}
        />
      </Layout.Page>
    );
  }

  if (!loadingProjects && project && !project.hasAccess) {
    return (
      <Layout.Page>
        <MissingProjectMembership organization={organization} project={project} />
      </Layout.Page>
    );
  }

  return (
    <SentryDocumentTitle title={title}>
      <PageFiltersContainer
        disablePersistence
        skipLoadLastUsed
        showAbsolute={!hasOnlyBasicChart}
      >
        <Layout.Page>
          <NoProjectMessage organization={organization}>
            <Layout.Header unified>
              <Layout.HeaderContent unified>
                <Breadcrumbs
                  crumbs={[
                    {
                      to: makeProjectsPathname({path: '/', organization}),
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
                <ButtonBar>
                  <FeedbackButton />
                  <LinkButton
                    size="sm"
                    to={
                      // if we are still fetching project, we can use project slug to build issue stream url and let the redirect handle it
                      project?.id
                        ? `/organizations/${params.orgId}/issues/?project=${project.id}`
                        : `/${params.orgId}/${params.projectId}`
                    }
                  >
                    {t('View All Issues')}
                  </LinkButton>
                  <CreateAlertButton
                    size="sm"
                    organization={organization}
                    projectSlug={params.projectId}
                    aria-label={t('Create Alert')}
                  />
                  <LinkButton
                    size="sm"
                    icon={<IconSettings />}
                    aria-label={t('Settings')}
                    to={`/settings/${params.orgId}/projects/${params.projectId}/`}
                  />
                </ButtonBar>
              </Layout.HeaderActions>
            </Layout.Header>

            <Layout.Body noRowGap>
              <Layout.Main>
                <ProjectFiltersWrapper>
                  <ProjectFilters
                    query={query}
                    onSearch={handleSearch}
                    relativeDateOptions={
                      hasOnlyBasicChart
                        ? pick(DEFAULT_RELATIVE_PERIODS, ERRORS_BASIC_CHART_PERIODS)
                        : undefined
                    }
                    tagValueLoader={tagValueLoader}
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
                      <ErrorBoundary mini key={`project-charts-${id}`}>
                        <ProjectCharts
                          location={location}
                          organization={organization}
                          chartId={id}
                          chartIndex={index}
                          projectId={project?.id}
                          hasSessions={hasSessions}
                          hasTransactions={!!hasTransactions}
                          visibleCharts={visibleCharts}
                          query={query}
                          project={project}
                        />
                      </ErrorBoundary>
                    ))}
                    <ProjectIssues
                      organization={organization}
                      location={location}
                      projectId={selection.projects[0]!}
                      query={query}
                      api={api}
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
                  location={location}
                  isProjectStabilized={isProjectStabilized}
                  project={project}
                />
                <ProjectQuickLinks organization={organization} project={project} />
              </Layout.Side>
            </Layout.Body>
          </NoProjectMessage>
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

const ProjectFiltersWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;
