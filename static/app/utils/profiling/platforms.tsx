import {profiling} from 'sentry/data/platformCategories';
import {Project} from 'sentry/types/project';

export const supportedProfilingPlatforms = profiling;
export const supportedProfilingPlatformSDKs = [
  'android',
  'apple-ios',
  'node',
  'python',
  'php',
  'rust',
  'php',
  'ruby',
  'javascript-nextjs',
] as const;
export type SupportedProfilingPlatform = (typeof supportedProfilingPlatforms)[number];
export type SupportedProfilingPlatformSDK =
  (typeof supportedProfilingPlatformSDKs)[number];

export function getDocsPlatformSDKForPlatform(
  platform: string | undefined
): SupportedProfilingPlatform | null {
  if (!platform) {
    return null;
  }

  if (platform === 'android') {
    return 'android';
  }

  if (platform === 'apple-ios') {
    return 'apple-ios';
  }

  if (platform.startsWith('node')) {
    return 'node';
  }

  if (platform === 'javascript-nextjs') {
    return 'javascript-nextjs';
  }

  if (platform.startsWith('python')) {
    return 'python';
  }

  if (platform === 'rust') {
    return 'rust';
  }

  if (platform.startsWith('php')) {
    return 'php';
  }

  if (platform.startsWith('ruby')) {
    return 'ruby';
  }

  return null;
}

export function isProfilingSupportedOrProjectHasProfiles(project: Project): boolean {
  return !!(
    (project.platform && getDocsPlatformSDKForPlatform(project.platform)) ||
    // If this project somehow managed to send profiles, then profiling is supported for this project.
    // Sometimes and for whatever reason, platform can also not be set on a project so the above check alone would fail
    project.hasProfiles
  );
}

export function getProfilingDocsForPlatform(platform: string | undefined): string | null {
  const docsPlatform = getDocsPlatformSDKForPlatform(platform);
  if (!docsPlatform) {
    return null;
  }
  return docsPlatform === 'apple-ios'
    ? 'https://docs.sentry.io/platforms/apple/guides/ios/profiling/'
    : `https://docs.sentry.io/platforms/${docsPlatform}/profiling/`;
}
