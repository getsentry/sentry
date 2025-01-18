import {useState} from 'react';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import allPlatforms from 'sentry/data/platforms';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import GettingStarted from './gettingStarted';
import {ProjectInstallPlatform} from './platform';
import {PlatformIntegrationSetup} from './platformIntegrationSetup';

type Props = RouteComponentProps<{projectId: string}, {}>;

function PlatformOrIntegration({params}: Props) {
  const organization = useOrganization();
  const [integrationUseManualSetup, setIntegrationUseManualSetup] = useState(false);

  const {projects, initiallyLoaded} = useProjects({
    slugs: [params.projectId],
    orgId: organization.slug,
  });

  const loadingProjects = !initiallyLoaded;
  const project = !loadingProjects
    ? projects.find(proj => proj.slug === params.projectId)
    : undefined;

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform = allPlatforms.find(p => p.id === currentPlatformKey);

  const integrationSlug: string | undefined =
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    platformToIntegrationMap[currentPlatformKey];
  const showIntegrationOnboarding = integrationSlug && !integrationUseManualSetup;

  if (showIntegrationOnboarding) {
    return (
      <PlatformIntegrationSetup
        integrationSlug={integrationSlug}
        onClickManualSetup={() => setIntegrationUseManualSetup(true)}
        project={project}
        platform={currentPlatform}
        loading={loadingProjects}
      />
    );
  }

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
