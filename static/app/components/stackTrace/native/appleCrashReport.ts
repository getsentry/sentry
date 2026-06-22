import type {PlatformKey} from 'sentry/types/platform';

const APPLE_CRASH_REPORT_PLATFORMS: PlatformKey[] = ['native', 'cocoa'];

export function supportsAppleCrashReport(platform: PlatformKey | undefined) {
  return !!platform && APPLE_CRASH_REPORT_PLATFORMS.includes(platform);
}
