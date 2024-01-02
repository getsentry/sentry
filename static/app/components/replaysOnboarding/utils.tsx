import partition from 'lodash/partition';

import {replayFrontendPlatforms, replayPlatforms} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {PlatformIntegration, PlatformKey, Project} from 'sentry/types';

export function generateDocKeys(platform: PlatformKey): string[] {
  const platformKey = platform.startsWith('javascript')
    ? platform
    : 'javascript-' + platform;
  return ['1-install', '2-configure'].map(
    key => `${platformKey}-replay-onboarding-${key}`
  );
}

export function isPlatformSupported(platform: undefined | PlatformIntegration) {
  return platform?.id ? replayPlatforms.includes(platform?.id) : false;
}

export function splitProjectsByReplaySupport(projects: Project[]) {
  const [supported, unsupported] = partition(projects, project =>
    replayPlatforms.includes(project.platform!)
  );
  return {
    supported,
    unsupported,
  };
}

export const replayJsFrameworkOptions: PlatformIntegration[] = platforms.filter(p =>
  replayFrontendPlatforms.includes(p.id)
);
