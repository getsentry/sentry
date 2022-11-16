import {
  backend,
  desktop,
  frontend,
  mobile,
  PlatformCategory,
  serverless,
} from 'sentry/data/platformCategories';

export function platformToCategory(platform: string | undefined): PlatformCategory {
  if (!platform) {
    return PlatformCategory.other;
  }
  if (([...mobile] as string[]).includes(platform)) {
    return PlatformCategory.mobile;
  }
  if (([...frontend] as string[]).includes(platform)) {
    return PlatformCategory.frontend;
  }
  if (([...backend] as string[]).includes(platform)) {
    return PlatformCategory.backend;
  }
  if (([...serverless] as string[]).includes(platform)) {
    return PlatformCategory.serverless;
  }
  if (([...desktop] as string[]).includes(platform)) {
    return PlatformCategory.desktop;
  }
  return PlatformCategory.other;
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
