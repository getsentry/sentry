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
  if (
    isAppHangPlatform(platform) &&
    features?.includes('project-detail-apple-app-hang-rate')
  ) {
    return true;
  }
  return false;
}

export function isPlatformForegroundANRCompatible(platform?: PlatformKey) {
  return platform === 'javascript-electron' || platform === 'android';
}

export function getANRRateText(platform?: PlatformKey) {
  if (isAppHangPlatform(platform)) {
    return 'App Hang Rate';
  }

  return 'ANR Rate';
}

export function getANRIssueQueryText(platform?: PlatformKey) {
  if (isAppHangPlatform(platform)) {
    return 'error.type:["Fatal App Hang Fully Blocked","Fatal App Hang Non Fully Blocked"]';
  }

  return 'mechanism:[ANR,AppExitInfo]';
}

// Don't include apple-macos because the ANR rate requires app hangs V2,
// which is not available on macos, when writing this comment on 2025-03-17.
const isAppHangPlatform = (platform?: PlatformKey): boolean => {
  return platform === 'apple' || platform === 'apple-ios';
};
