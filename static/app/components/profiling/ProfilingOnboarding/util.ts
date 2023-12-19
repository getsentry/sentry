import partition from 'lodash/partition';

import type {PlatformKey} from 'sentry/types';
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

export const browserProfilingOnboardingDocKeysWithDocumentPolicy = [
  '1-install',
  '2-configure-document-policy',
  '3-configure',
] as const;

type ProfilingOnboardingDocKeys = (typeof profilingOnboardingDocKeys)[number];
type BrowserProfilingOnboardingDocKeys =
  (typeof browserProfilingOnboardingDocKeysWithDocumentPolicy)[number];

export const supportedPlatformExpectedDocKeys: Record<
  SupportedProfilingPlatformSDK,
  ProfilingOnboardingDocKeys[] | BrowserProfilingOnboardingDocKeys[]
> = {
  android: ['1-install', '2-configure-performance', '3-configure-profiling', '4-upload'],
  'apple-ios': [
    '1-install',
    '2-configure-performance',
    '3-configure-profiling',
    '4-upload',
  ],
  go: ['0-alert', '1-install', '2-configure-performance', '3-configure-profiling'],
  node: ['1-install', '2-configure-performance', '3-configure-profiling'],
  python: ['1-install', '2-configure-performance', '3-configure-profiling'],
  php: ['1-install', '2-configure-performance', '3-configure-profiling'],
  'php-laravel': ['1-install', '2-configure-performance', '3-configure-profiling'],
  'php-symfony2': ['1-install', '2-configure-performance', '3-configure-profiling'],
  ruby: ['0-alert', '1-install', '2-configure-performance', '3-configure-profiling'],
  'javascript-nextjs': ['1-install', '2-configure-performance', '3-configure-profiling'],
  'javascript-remix': ['1-install', '2-configure-performance', '3-configure-profiling'],
  'javascript-sveltekit': [
    '1-install',
    '2-configure-performance',
    '3-configure-profiling',
  ],
  javascript: ['1-install', '2-configure-document-policy', '3-configure'],
  'javascript-react': ['1-install', '2-configure-document-policy', '3-configure'],
  'javascript-angular': ['1-install', '2-configure-document-policy', '3-configure'],
  'javascript-vue': ['1-install', '2-configure-document-policy', '3-configure'],
  'react-native': [
    '0-alert',
    '1-install',
    '2-configure-performance',
    '3-configure-profiling',
  ],
  flutter: ['0-alert', '1-install', '2-configure-performance', '3-configure-profiling'],
  'dart-flutter': [
    '0-alert',
    '1-install',
    '2-configure-performance',
    '3-configure-profiling',
  ],
};

function makeDocKey(platformId: SupportedProfilingPlatformSDK, key: string) {
  if (platformId === 'javascript-nextjs') {
    return `node-javascript-nextjs-profiling-onboarding-${key}`;
  }
  if (platformId === 'javascript-remix') {
    return `node-javascript-remix-profiling-onboarding-${key}`;
  }
  if (platformId === 'javascript-sveltekit') {
    return `node-javascript-sveltekit-profiling-onboarding-${key}`;
  }
  return `${platformId}-profiling-onboarding-${key}`;
}

type DocKeyMap = Record<
  (ProfilingOnboardingDocKeys | BrowserProfilingOnboardingDocKeys)[number],
  string
>;
export function makeDocKeyMap(platformId: PlatformKey | undefined) {
  const docsPlatform = getDocsPlatformSDKForPlatform(platformId);

  if (!platformId || !docsPlatform) {
    return null;
  }

  const expectedDocKeys: (
    | ProfilingOnboardingDocKeys
    | BrowserProfilingOnboardingDocKeys
  )[] = supportedPlatformExpectedDocKeys[docsPlatform];

  if (!expectedDocKeys) {
    return null;
  }

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
