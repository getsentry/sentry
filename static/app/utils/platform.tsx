import {
  backend,
  desktop,
  frontend,
  mobile,
  PlatformCategory,
  serverless,
} from 'sentry/data/platformCategories';

const platformCategoryMap = {};
mobile.forEach(platform => (platformCategoryMap[platform] = PlatformCategory.mobile));
frontend.forEach(platform => (platformCategoryMap[platform] = PlatformCategory.frontend));
backend.forEach(platform => (platformCategoryMap[platform] = PlatformCategory.backend));
serverless.forEach(
  platform => (platformCategoryMap[platform] = PlatformCategory.backend)
);
desktop.forEach(platform => (platformCategoryMap[platform] = PlatformCategory.backend));

/**
 *
 * @param platform - a SDK platform, for example javacsript
 * @returns - the platform category
 */
export function platformToCategory(platform: string | undefined): PlatformCategory {
  if (!platform || !platformCategoryMap[platform]) {
    return PlatformCategory.other;
  }
  return platformCategoryMap[platform];
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
