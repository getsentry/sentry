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
import type {PlatformKey} from 'sentry/types/platform';

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

export function isNativePlatform(platform: string | undefined) {
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

function startsWithPunctuation(name: string) {
  return /^\p{P}/u.test(name);
}

/**
 * Sort comparator for platform display names, matching the legacy platform
 * picker's non-popular tabs: alphabetical, except names starting with
 * punctuation (the .NET family) sort last instead of first.
 */
export function comparePlatformNames(a: string, b: string): number {
  const aStartsWithPunctuation = startsWithPunctuation(a);
  const bStartsWithPunctuation = startsWithPunctuation(b);
  if (aStartsWithPunctuation !== bStartsWithPunctuation) {
    return aStartsWithPunctuation ? 1 : -1;
  }
  return a.localeCompare(b);
}

export function isDisabledGamingPlatform({
  platform,
  enabledConsolePlatforms,
}: {
  platform: Pick<Platform, 'id' | 'type'>;
  enabledConsolePlatforms?: string[];
}) {
  return platform.type === 'console' && !enabledConsolePlatforms?.includes(platform.id);
}
