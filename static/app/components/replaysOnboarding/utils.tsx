import partition from 'lodash/partition';

import {PlatformKey, replayPlatforms} from 'sentry/data/platformCategories';
import {PlatformIntegration, Project} from 'sentry/types';

export function generateDocKeys(platform: PlatformKey): string[] {
  return ['1-install', '2-configure'].map(key => `${platform}-replay-onboarding-${key}`);
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
