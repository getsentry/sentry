import {PreprodOnboardingPanel} from 'sentry/components/preprod/preprodOnboardingPanel';
import type {PlatformKey} from 'sentry/types/project';

interface PreprodOnboardingProps {
  organizationSlug: string;
  projectPlatform: PlatformKey | null;
  projectSlug: string;
}

export function PreprodOnboarding(props: PreprodOnboardingProps) {
  const {projectPlatform} = props;

  return <PreprodOnboardingPanel platform={projectPlatform} />;
}
