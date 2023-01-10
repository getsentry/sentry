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
export type SupportedProfilingPlatform = typeof supportedProfilingPlatforms[number];
export type SupportedProfilingPlatformSDK = typeof supportedProfilingPlatformSDKs[number];

const platformToDocsPlatformSDK: Record<
  SupportedProfilingPlatform,
  SupportedProfilingPlatformSDK
> = {
  android: 'android',
  'apple-ios': 'apple-ios',
  node: 'node',
  'node-express': 'node',
  'node-koa': 'node',
  'node-connect': 'node',
  python: 'python',
  'python-django': 'python',
  'python-flask': 'python',
  'python-sanic': 'python',
  'python-bottle': 'python',
  'python-pylons': 'python',
  'python-pyramid': 'python',
  'python-tornado': 'python',
  rust: 'rust',
};

export function isProfilingSupportedOrProjectHasProfiles(project: Project): boolean {
  return !!(
    (project.platform && platformToDocsPlatformSDK[project.platform]) ||
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

type ProfilingOnboardingDocKeys = typeof profilingOnboardingDocKeys[number];

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

type DocKeyMap = Record<typeof profilingOnboardingDocKeys[number], string>;
export function makeDocKeyMap(platformId: PlatformKey | undefined) {
  if (!platformId || !platformToDocsPlatformSDK[platformId]) {
    return null;
  }

  const docsPlatform = platformToDocsPlatformSDK[platformId];

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
    project => project.platform && platformToDocsPlatformSDK[project.platform]
  );

  return {supported, unsupported};
}
