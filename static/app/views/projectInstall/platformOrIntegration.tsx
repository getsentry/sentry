import {useState} from 'react';
import type {RouteComponentProps} from 'react-router';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import type {PlatformIntegration} from 'sentry/types/project';
import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import GettingStarted from './gettingStarted';
import {ProjectInstallPlatform} from './platform';
import PlatformIntegrationSetup from './platformIntegrationSetup';

const allPlatforms: PlatformIntegration[] = [
  ...platforms,
  {
    id: 'other',
    name: t('Other'),
    link: 'https://docs.sentry.io/platforms/',
    type: 'language',
    language: 'other',
  },
];

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
    platformToIntegrationMap[currentPlatformKey];
  const showIntegrationOnboarding = integrationSlug && !integrationUseManualSetup;

  if (showIntegrationOnboarding) {
    return (
      <PlatformIntegrationSetup
        integrationSlug={integrationSlug}
        onClickManualSetup={() => setIntegrationUseManualSetup(true)}
        project={project}
        platform={currentPlatform}
      />
    );
  }

  return (
    <OnboardingContextProvider>
      <GettingStarted>
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
