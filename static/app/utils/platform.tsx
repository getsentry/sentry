import {
  backend,
  desktop,
  frontend,
  mobile,
  PlatformCategory,
  serverless,
} from 'sentry/data/platformCategories';
import {PlatformKey} from 'sentry/types';

/**
 *
 * @param platform - a SDK platform, for example `node-express`, `javascript-react`
 * @returns - the platform category, for example `backend`, `serverless`
 */
export function platformToCategory(platform: PlatformKey | undefined): PlatformCategory {
  if (!platform) {
    return PlatformCategory.OTHER;
  }
  if (([...frontend] as string[]).includes(platform)) {
    return PlatformCategory.FRONTEND;
  }
  if (([...backend] as string[]).includes(platform)) {
    return PlatformCategory.BACKEND;
  }
  if (([...serverless] as string[]).includes(platform)) {
    return PlatformCategory.SERVERLESS;
  }
  if (([...mobile] as string[]).includes(platform)) {
    return PlatformCategory.MOBILE;
  }
  if (([...desktop] as string[]).includes(platform)) {
    return PlatformCategory.DESKTOP;
  }
  return PlatformCategory.OTHER;
}

export function isNativePlatform(platform: string | undefined) {
  switch (platform) {
    case 'cocoa':
    case 'objc':
    case 'native':
    case 'swift':
    case 'c':
      return true;
    default:
      return false;
  }
}

export function isMobilePlatform(platform: string | undefined) {
  if (!platform) {
    return false;
  }

  return ([...mobile] as string[]).includes(platform);
}
