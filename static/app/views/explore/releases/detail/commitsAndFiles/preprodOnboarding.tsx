import type {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {PreprodOnboardingPanel} from 'sentry/components/preprod/preprodOnboardingPanel';
import type {PlatformKey} from 'sentry/types/platform';

interface PreprodOnboardingProps {
  display: PreprodBuildsDisplay;
  projectPlatform: PlatformKey | null;
}

export function PreprodOnboarding({display, projectPlatform}: PreprodOnboardingProps) {
  return <PreprodOnboardingPanel display={display} platform={projectPlatform} />;
}
