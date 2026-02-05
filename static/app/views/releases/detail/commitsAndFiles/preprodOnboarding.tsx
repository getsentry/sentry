import {PreprodOnboardingPanel} from 'sentry/components/preprod/preprodOnboardingPanel';
import type {PlatformKey} from 'sentry/types/project';

interface PreprodOnboardingProps {
  projectPlatform: PlatformKey | null;
}

export function PreprodOnboarding({projectPlatform}: PreprodOnboardingProps) {
  return <PreprodOnboardingPanel platform={projectPlatform} />;
}
