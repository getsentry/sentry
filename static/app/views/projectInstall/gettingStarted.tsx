import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import Redirect from 'sentry/components/redirect';
import allPlatforms from 'sentry/data/platforms';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

import {ProjectInstallPlatform} from './platform';

type Props = RouteComponentProps<{projectId: string}>;

function GettingStarted({params}: Props) {
  const organization = useOrganization();

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
    <OnboardingContextProvider>
      <GettingStartedLayout withPadding>
        {loadingProjects ? (
          <LoadingIndicator />
        ) : project ? (
          <ProjectInstallPlatform
            project={project}
            platform={currentPlatform}
            currentPlatformKey={currentPlatformKey}
          />
        ) : (
          <Redirect
            to={makeProjectsPathname({
              path: `/new/`,
              organization,
            })}
          />
        )}
      </GettingStartedLayout>
    </OnboardingContextProvider>
  );
}

const GettingStartedLayout = styled(Layout.Page)`
  background: ${p => p.theme.background};
  padding-top: ${space(3)};
`;

export default GettingStarted;
