import type {Platform} from 'sentry/components/platformPicker';
import {
  backend,
  desktop,
  frontend,
  gaming,
  mobile,
  PlatformCategory,
  serverless,
} from 'sentry/data/platformCategories';
import type {PlatformKey} from 'sentry/types/project';

/**
 *
 * @param platform - a SDK platform, for example `node-express`, `javascript-react`
 * @returns - the platform category, for example `backend`, `serverless`
 */
export function platformToCategory(platform: PlatformKey | undefined): PlatformCategory {
  if (!platform) {
    return PlatformCategory.OTHER;
  }
  if ((frontend as string[]).includes(platform)) {
    return PlatformCategory.FRONTEND;
  }
  if ((backend as string[]).includes(platform)) {
    return PlatformCategory.BACKEND;
  }
  if ((serverless as string[]).includes(platform)) {
    return PlatformCategory.SERVERLESS;
  }
  if ((mobile as string[]).includes(platform)) {
    return PlatformCategory.MOBILE;
  }
  if ((desktop as string[]).includes(platform)) {
    return PlatformCategory.DESKTOP;
  }
  if ((gaming as string[]).includes(platform)) {
    return PlatformCategory.GAMING;
  }
  return PlatformCategory.OTHER;
}

export function isNativePlatform(platform: string | undefined): boolean {
  switch (platform) {
    case 'cocoa':
    case 'objc':
    case 'native':
    case 'swift':
    case 'c':
    case 'nintendo-switch':
    case 'playstation':
    case 'xbox':
      return true;
    default:
      return false;
  }
}

export function isJavascriptPlatform(platform: string | undefined) {
  return platform?.includes('javascript');
}

export function isMobilePlatform(platform: string | undefined) {
  if (!platform) {
    return false;
  }

  return (mobile as string[]).includes(platform);
}

export function isDisabledGamingPlatform({
  platform,
  enabledConsolePlatforms,
}: {
  platform: Platform;
  enabledConsolePlatforms?: string[];
}) {
  return platform.type === 'console' && !enabledConsolePlatforms?.includes(platform.id);
}
