import {PlatformKey, replayPlatforms} from 'sentry/data/platformCategories';
import {PlatformIntegration} from 'sentry/types';

export function generateDocKeys(platform: PlatformKey): string[] {
  return ['1-install', '2-configure'].map(key => `${platform}-replay-onboarding-${key}`);
}

export function isPlatformSupported(platform: undefined | PlatformIntegration) {
  return platform?.id ? replayPlatforms.includes(platform?.id) : false;
}
