import {Fragment, useCallback, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {updateProjects} from 'sentry/actionCreators/pageFilters';
import {fetchTagValues} from 'sentry/actionCreators/tags';
import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CreateAlertButton from 'sentry/components/createAlertButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import MissingProjectMembership from 'sentry/components/projects/missingProjectMembership';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import routeTitleGen from 'sentry/utils/routeTitle';
import useApi from 'sentry/utils/useApi';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';

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

type Props = RouteComponentProps<RouteParams> & {
  organization: Organization;
};

export default function ProjectDetail({router, location, organization}: Props) {
  const api = useApi();
  const params = useParams();
  const {projects, fetching: loadingProjects} = useProjects();
  const {selection} = usePageFilters();
  const project = projects.find(p => p.slug === params.projectId);
  const {query} = location.query;
  const hasPerformance = organization.features.includes('performance-view');
  const hasDiscover = organization.features.includes('discover-basic');
  const hasTransactions = hasPerformance && project?.firstTransactionEvent;
  const projectId = project?.id;
  const isProjectStabilized =
    defined(project?.id) &&
    project.id === location.query.project &&
    project.id === String(selection.projects[0]);
  const hasSessions = project?.hasSessions ?? null;
  const hasOnlyBasicChart = !hasPerformance && !hasDiscover && !hasSessions;
  const title = routeTitleGen(
    t('Project %s', params.projectId),
    organization.slug,
    false
  );
  const prefersStackedNav = usePrefersStackedNav();

  const visibleCharts = useMemo(() => {
    if (hasTransactions || hasSessions) {
      return ['chart1', 'chart2'];
    }
    return ['chart1'];
  }, [hasTransactions, hasSessions]);

  const onRetryProjects = useCallback(() => {
    fetchOrganizationDetails(api, params.orgId!);
  }, [api, params.orgId]);

  const handleSearch = useCallback(
    (searchQuery: string) => {
      router.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          query: searchQuery,
        },
      });
    },
    [router, location.query, location.pathname]
  );

  const tagValueLoader = useCallback(
    (key: string, search: string) => {
      return fetchTagValues({
        api,
        orgSlug: organization.slug,
        tagKey: key,
        search,
        projectIds: location.query.project ? [location.query.project] : undefined,
        endpointParams: location.query,
      });
    },
    [api, organization.slug, location.query]
  );

  useEffect(() => {
    function syncProjectWithSlug() {
      if (projectId && projectId !== location.query.project) {
        // if someone visits /organizations/sentry/projects/javascript/ (without ?project=XXX) we need to update URL and globalSelection with the right project ID
        updateProjects([Number(projectId)], router);
      }
    }
    syncProjectWithSlug();
  }, [location.query.project, router, projectId]);

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
            <Layout.Header unified={prefersStackedNav}>
              <Layout.HeaderContent unified={prefersStackedNav}>
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
                  <FeedbackWidgetButton />
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
              <ErrorBoundary customComponent={null}>
                {project && <StyledGlobalEventProcessingAlert projects={[project]} />}
              </ErrorBoundary>
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
                          router={router}
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
                    projectSlug={params.projectId!}
                    location={location}
                    isProjectStabilized={isProjectStabilized}
                  />
                </Feature>
                <ProjectLatestReleases
                  organization={organization}
                  projectSlug={params.projectId!}
                  location={location}
                  isProjectStabilized={isProjectStabilized}
                  project={project}
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
    </SentryDocumentTitle>
  );
}

const ProjectFiltersWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }
`;
