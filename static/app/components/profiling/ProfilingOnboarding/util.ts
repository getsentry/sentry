import {PlatformKey} from 'sentry/data/platformCategories';
import {Project} from 'sentry/types/project';

export const supportedProfilingPlatforms = [
  'android',
  'apple-ios',
  'node',
  'python',
] as const;

export type SupportedProfilingPlatform = Extract<
  PlatformKey,
  typeof supportedProfilingPlatforms[number]
>;

export const profilingOnboardingDocKeys = [
  '0-alert',
  '1-install',
  '2-configure-performance',
  '3-configure-profiling',
  '4-upload',
] as const;

type ProfilingOnboardingDocKeys = typeof profilingOnboardingDocKeys[number];

export const supportedPlatformExpectedDocKeys: Record<
  SupportedProfilingPlatform,
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
};

function makeDocKey(platformId: PlatformKey, key: string) {
  return `${platformId}-profiling-onboarding-${key}`;
}

type DocKeyMap = Record<typeof profilingOnboardingDocKeys[number], string>;
export function makeDocKeyMap(platformId: PlatformKey | undefined) {
  if (!platformId) {
    return null;
  }
  const expectedDocKeys: ProfilingOnboardingDocKeys[] =
    supportedPlatformExpectedDocKeys[platformId];
  return expectedDocKeys.reduce((acc: DocKeyMap, key) => {
    acc[key] = makeDocKey(platformId, key);
    return acc;
  }, {} as DocKeyMap);
}

export function splitProjectsByProfilingSupport(projects: Project[]): {
  supported: Project[];
  unsupported: Project[];
} {
  const supported: Project[] = [];
  const unsupported: Project[] = [];

  for (const project of projects) {
    if (
      project.platform &&
      supportedProfilingPlatforms.includes(project.platform as SupportedProfilingPlatform)
    ) {
      supported.push(project);
    } else {
      unsupported.push(project);
    }
  }

  return {supported, unsupported};
}
