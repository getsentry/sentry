import {createContext, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {redirectToProject} from 'sentry/actionCreators/redirectToProject';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {MissingProjectMembership} from 'sentry/components/projects/missingProjectMembership';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {
  addProjectFeaturesHandler,
  buildSentryFeaturesHandler,
} from 'sentry/utils/featureFlags';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';

export const ProjectRouteContext = createContext<Project | null>(null);

interface ProjectRouteProviderProps {
  children: React.ReactNode;
  projectSlug: string;
}

function isNotFoundError(error: Error | null) {
  return (error as RequestError | null)?.status === 404;
}

export function ProjectRouteProvider({children, projectSlug}: ProjectRouteProviderProps) {
  const organization = useOrganization();
  const {
    initiallyLoaded: projectsInitiallyLoaded,
    projects,
    fetching: fetchingProjects,
  } = useProjects({slugs: [projectSlug]});

  const summaryProject = useMemo(
    () => projects.find(({slug}) => slug === projectSlug) ?? null,
    [projects, projectSlug]
  );

  const missingProjectMembership = summaryProject
    ? !summaryProject.hasAccess && !summaryProject.isMember
    : false;

  const {
    data: detailedProject,
    error: detailedProjectError,
    isPending: isDetailedProjectPending,
    refetch,
  } = useDetailedProject({orgSlug: organization.slug, projectSlug});

  useEffect(() => {
    if (!detailedProject) {
      return;
    }

    if (detailedProject.slug !== projectSlug) {
      redirectToProject(detailedProject.slug);
      return;
    }

    addProjectFeaturesHandler({
      project: detailedProject,
      handler: buildSentryFeaturesHandler('feature.projects:'),
    });
  }, [detailedProject, projectSlug]);

  const title = detailedProject?.slug ?? summaryProject?.slug ?? 'Sentry';

  // Still loading project list or initial detailed project fetch
  const loading =
    fetchingProjects || !projectsInitiallyLoaded || isDetailedProjectPending;
  // Project was renamed -- show loading while the useEffect redirect fires
  const projectRenamed = detailedProject && detailedProject.slug !== projectSlug;

  if (loading || projectRenamed) {
    return (
      <SentryDocumentTitle noSuffix title={title}>
        <div className="loading-full-layout">
          <LoadingIndicator />
        </div>
      </SentryDocumentTitle>
    );
  }

  // User lacks both access and membership
  if (missingProjectMembership) {
    return (
      <SentryDocumentTitle noSuffix title={title}>
        <ErrorWrapper>
          <MissingProjectMembership
            organization={organization}
            project={summaryProject}
          />
        </ErrorWrapper>
      </SentryDocumentTitle>
    );
  }

  // Happy path: detailed project loaded and slug matches
  if (summaryProject?.slug && detailedProject?.slug === projectSlug) {
    return (
      <SentryDocumentTitle noSuffix title={title}>
        <ProjectRouteContext value={detailedProject}>{children}</ProjectRouteContext>
      </SentryDocumentTitle>
    );
  }

  // Project not in store or API returned 404
  if (!summaryProject || isNotFoundError(detailedProjectError)) {
    return (
      <SentryDocumentTitle noSuffix title={title}>
        <Stack flex={1} padding="2xl 3xl">
          <Alert.Container>
            <Alert variant="warning" showIcon={false}>
              {t('The project you were looking for was not found.')}
            </Alert>
          </Alert.Container>
        </Stack>
      </SentryDocumentTitle>
    );
  }

  // Unknown error fetching detailed project
  return (
    <SentryDocumentTitle noSuffix title={title}>
      <LoadingError onRetry={refetch} />
    </SentryDocumentTitle>
  );
}

const ErrorWrapper = styled('div')`
  width: 100%;
  margin: ${p => p.theme.space.xl} ${p => p.theme.space['3xl']};
`;
