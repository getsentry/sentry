import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Redirect} from 'sentry/components/redirect';
import {allPlatforms} from 'sentry/data/platforms';
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

  const project = loadingProjects
    ? undefined
    : projects.find(proj => proj.slug === params.projectId);

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
            path: `/new/`,
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
