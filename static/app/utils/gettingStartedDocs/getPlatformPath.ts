import type {PlatformIntegration} from 'sentry/types/project';

export function getPlatformPath(platform: PlatformIntegration) {
  // some platforms use a naming convention that combines 'language' and 'id' with a hyphen in between. For example, 'react-native'.
  if (platform.id === platform.language) {
    return `${platform.language}/${platform.language}`;
  }

  const framework = platform.id.split('-')[1];

  if (framework) {
    return `${platform.language}/${framework}`;
  }

  return `${platform.language}/${platform.language}`;
}
