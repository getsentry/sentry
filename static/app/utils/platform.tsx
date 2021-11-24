import {mobile} from 'sentry/data/platformCategories';

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
