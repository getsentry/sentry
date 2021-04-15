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

export type DocPlatform = typeof platforms[number];

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

export function getDocsPlatform(platform: string, performanceOnly: boolean): DocPlatform {
  // react-native is the only platform that has a dash, and supports performance so we can skip that check
  if (platform === 'react-native') {
    return 'react-native';
  }
  const prefix = platform.substring(0, platform.indexOf('-'));
  if (validDocPlatform(prefix)) {
    const validPerformancePrefix = performancePlatforms.includes(prefix);
    if ((performanceOnly && validPerformancePrefix) || !performanceOnly) {
      return prefix;
    }
  }
  // If all else fails return the most popular platform
  return 'javascript';
}
