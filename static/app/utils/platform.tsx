import {mobile} from 'sentry/data/platformCategories';

export function isNativePlatform(platform: string | undefined): boolean {
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

export function isMobilePlatform(platform: string | undefined): boolean {
  if (!platform) {
    return false;
  }

  return !!mobile.find(p => p === platform);
}
