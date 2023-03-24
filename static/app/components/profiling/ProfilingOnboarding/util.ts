import partition from 'lodash/partition';

import {PlatformKey} from 'sentry/data/platformCategories';
import {Project} from 'sentry/types/project';
import {
  getDocsPlatformSDKForPlatform,
  SupportedProfilingPlatformSDK,
} from 'sentry/utils/profiling/platforms';

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
  php: ['0-alert', '1-install', '2-configure-performance', '3-configure-profiling'],
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
