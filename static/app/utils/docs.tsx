import {AvatarProject} from 'sentry/types';

const platforms = [
  'dotnet',
  'android',
  'apple',
  'dart',
  'elixir',
  'flutter',
  'go',
  'java',
  'javascript',
  'native',
  'node',
  'perl',
  'php',
  'python',
  'react-native',
  'ruby',
  'rust',
  'unity',
] as const;

export type DocPlatform = (typeof platforms)[number];

const performancePlatforms: DocPlatform[] = [
  'dotnet',
  'android',
  'apple',
  'go',
  'java',
  'javascript',
  'node',
  'php',
  'python',
  'react-native',
  'ruby',
];

function validDocPlatform(platform: any): platform is DocPlatform {
  return platforms.includes(platform);
}

export function getDocsPlatform(
  platform: string,
  performanceOnly: boolean
): DocPlatform | null {
  // react-native is the only platform that has a dash, and supports performance so we can skip that check
  if (platform === 'react-native') {
    return 'react-native';
  }
  const index = platform.indexOf('-');
  const prefix = index >= 0 ? platform.substring(0, index) : platform;
  if (validDocPlatform(prefix)) {
    const validPerformancePrefix = performancePlatforms.includes(prefix);
    if ((performanceOnly && validPerformancePrefix) || !performanceOnly) {
      return prefix;
    }
  }
  // can't find a matching docs platform
  return null;
}

export function getConfigureTracingDocsLink(
  project: AvatarProject | undefined
): string | null {
  const platform = project?.platform ?? null;
  const docsPlatform = platform ? getDocsPlatform(platform, true) : null;
  return docsPlatform === null
    ? null // this platform does not support performance
    : `https://docs.sentry.io/platforms/${docsPlatform}/performance/`;
}

export function getConfigureIntegrationsDocsLink(
  project: AvatarProject | undefined
): string | null {
  const platform = project?.platform ?? null;
  const docsPlatform = platform ? getDocsPlatform(platform, true) : null;
  return docsPlatform === null
    ? null // this platform does not support performance
    : `https://docs.sentry.io/platforms/${docsPlatform}/configuration/integrations`;
}
