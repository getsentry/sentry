import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import allPlatforms from 'sentry/data/platforms';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import GettingStarted from './gettingStarted';
import {ProjectInstallPlatform} from './platform';

type Props = RouteComponentProps<{projectId: string}>;

function PlatformOrIntegration({params}: Props) {
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
      <GettingStarted withPadding>
        <ProjectInstallPlatform
          project={project}
          loading={loadingProjects}
          platform={currentPlatform}
          currentPlatformKey={currentPlatformKey}
        />
      </GettingStarted>
    </OnboardingContextProvider>
  );
}

export default PlatformOrIntegration;
