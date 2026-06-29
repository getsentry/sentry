import {useRef} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Redirect} from 'sentry/components/redirect';
import {allPlatforms} from 'sentry/data/platforms';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

import {ProjectInstallPlatform} from './platform';

export default function GettingStarted() {
  const organization = useOrganization();
  const params = useParams<{projectId: string}>();

  const {projects, initiallyLoaded} = useProjects({
    slugs: [params.projectId],
    orgId: organization.slug,
  });

  const loadingProjects = !initiallyLoaded;

  const projectInStore = loadingProjects
    ? undefined
    : projects.find(proj => proj.slug === params.projectId);

  // Keep rendering a project that disappears from the store mid-session: the
  // back nav deletes inactive projects before navigating (see
  // PlatformDocHeader's handleGoBack), and bouncing to the create-project page
  // here would race that navigation's referrer/project query params. The
  // redirect below is only for projects that were never found.
  const lastFoundProjectRef = useRef<Project | undefined>(undefined);
  if (projectInStore) {
    lastFoundProjectRef.current = projectInStore;
  }
  const project =
    projectInStore ??
    (lastFoundProjectRef.current?.slug === params.projectId
      ? lastFoundProjectRef.current
      : undefined);

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform = allPlatforms.find(p => p.id === currentPlatformKey);

  return (
    <GettingStartedLayout flex={1} padding="2xl 3xl">
      {loadingProjects ? (
        <LoadingIndicator />
      ) : project ? (
        <ProjectInstallPlatform project={project} platform={currentPlatform} />
      ) : (
        <Redirect
          to={makeProjectsPathname({
            path: '/new/',
            organization,
          })}
        />
      )}
    </GettingStartedLayout>
  );
}

const GettingStartedLayout = styled(Stack)`
  background: ${p => p.theme.tokens.background.primary};
`;
