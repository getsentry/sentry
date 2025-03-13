import type {Location} from 'history';

import type {PlatformKey} from 'sentry/types/project';

export function didProjectOrEnvironmentChange(location1: Location, location2: Location) {
  return (
    location1.query.environment !== location2.query.environment ||
    location1.query.project !== location2.query.project
  );
}

export function isPlatformANRCompatible(platform?: PlatformKey, features?: string[]) {
  if (isPlatformForegroundANRCompatible(platform)) {
    return true;
  }
  if (platform === 'apple' || platform === 'apple-ios') {
    if (features?.includes('projects:project-detail-apple-app-hang-rate')) {
      return true;
    }
  }
  return false;
}

export function isPlatformForegroundANRCompatible(platform?: PlatformKey) {
  return platform === 'javascript-electron' || platform === 'android';
}
