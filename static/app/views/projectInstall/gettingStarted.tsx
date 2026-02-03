import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Redirect from 'sentry/components/redirect';
import allPlatforms from 'sentry/data/platforms';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
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
    <GettingStartedLayout withPadding>
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

const GettingStartedLayout = styled(Layout.Page)`
  background: ${p => p.theme.tokens.background.primary};
  padding-top: ${space(3)};
`;
