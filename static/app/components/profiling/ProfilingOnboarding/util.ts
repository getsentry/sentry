import partition from 'lodash/partition';

import {PlatformKey, profiling} from 'sentry/data/platformCategories';
import {Project} from 'sentry/types/project';

export const supportedProfilingPlatforms = profiling;
export const supportedProfilingPlatformSDKs = [
  'android',
  'apple-ios',
  'node',
  'python',
  'rust',
] as const;
export type SupportedProfilingPlatform = (typeof supportedProfilingPlatforms)[number];
export type SupportedProfilingPlatformSDK =
  (typeof supportedProfilingPlatformSDKs)[number];

function getDocsPlatformSDKForPlatform(platform): PlatformKey | null {
  if (platform === 'android') {
    return 'android';
  }

  if (platform === 'apple-ios') {
    return 'apple-ios';
  }

  if (platform.startsWith('node')) {
    return 'node';
  }

  if (platform.startsWith('python')) {
    return 'python';
  }

  if (platform === 'rust') {
    return 'rust';
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

export const profilingOnboardingDocKeys = [
  '0-alert',
  '1-install',
  '2-configure-performance',
  '3-configure-profiling',
  '4-upload',
] as const;

type ProfilingOnboardingDocKeys = (typeof profilingOnboardingDocKeys)[number];

export const supportedPlatformExpectedDocKeys: Record<
  SupportedProfilingPlatformSDK,
  ProfilingOnboardingDocKeys[]
> = {
  android: ['1-install', '2-configure-performance', '3-configure-profiling', '4-upload'],
  'apple-ios': [
    '1-install',
    '2-configure-performance',
    '3-configure-profiling',
    '4-upload',
  ],
  node: ['0-alert', '1-install', '2-configure-performance', '3-configure-profiling'],
  python: ['0-alert', '1-install', '2-configure-performance', '3-configure-profiling'],
  rust: ['0-alert', '1-install', '2-configure-performance', '3-configure-profiling'],
};

function makeDocKey(platformId: PlatformKey, key: string) {
  return `${platformId}-profiling-onboarding-${key}`;
}

type DocKeyMap = Record<(typeof profilingOnboardingDocKeys)[number], string>;
export function makeDocKeyMap(platformId: PlatformKey | undefined) {
  const docsPlatform = getDocsPlatformSDKForPlatform(platformId);

  if (!platformId || !docsPlatform) {
    return null;
  }

  const expectedDocKeys: ProfilingOnboardingDocKeys[] =
    supportedPlatformExpectedDocKeys[docsPlatform];
  return expectedDocKeys.reduce((acc: DocKeyMap, key) => {
    acc[key] = makeDocKey(docsPlatform, key);
    return acc;
  }, {} as DocKeyMap);
}

export function splitProjectsByProfilingSupport(projects: Project[]): {
  supported: Project[];
  unsupported: Project[];
} {
  const [supported, unsupported] = partition(
    projects,
    project => project.platform && getDocsPlatformSDKForPlatform(project.platform)
  );

  return {supported, unsupported};
}
