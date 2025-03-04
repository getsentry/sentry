import type {Location} from 'history';

import type {PlatformKey} from 'sentry/types/project';

export function didProjectOrEnvironmentChange(location1: Location, location2: Location) {
  return (
    location1.query.environment !== location2.query.environment ||
    location1.query.project !== location2.query.project
  );
}

export function isPlatformANRCompatible(platform?: PlatformKey) {
  return (
    isPlatformForegroundANRCompatible(platform) ||
    platform === 'apple' ||
    platform === 'apple-ios'
  );
}

export function isPlatformForegroundANRCompatible(platform?: PlatformKey) {
  return platform === 'javascript-electron' || platform === 'android';
}

export function getANRRateText(platform?: PlatformKey) {
  if (platform === 'apple' || platform === 'apple-ios') {
    return 'App Hang Rate';
  }

  return 'ANR Rate';
}
