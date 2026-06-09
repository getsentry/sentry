import type {PlatformKey} from 'sentry/types/project';

const APPLE_CRASH_REPORT_PLATFORMS: PlatformKey[] = [
  'native',
  'cocoa',
  'nintendo-switch',
  'playstation',
  'xbox',
];

export function supportsAppleCrashReport(platform: PlatformKey | undefined) {
  return !!platform && APPLE_CRASH_REPORT_PLATFORMS.includes(platform);
}
