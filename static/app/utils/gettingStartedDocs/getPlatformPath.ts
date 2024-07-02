import type {PlatformIntegration} from 'sentry/types/project';

export function getPlatformPath(platform: PlatformIntegration) {
  // some platforms use a naming convention that combines 'language' and 'id' with a hyphen in between. For example, 'react-native'.
  if (platform.id === platform.language) {
    // Ionic is a special case as it is closely intertwined with Capacitor and often used together.
    // Consequently, they can utilize the same SDK documentation, specifically that of Capacitor.
    if (platform.language === 'ionic') {
      return 'capacitor/capacitor';
    }

    return `${platform.language}/${platform.language}`;
  }

  const framework = platform.id.split('-')[1];

  if (framework) {
    return `${platform.language}/${framework}`;
  }

  return `${platform.language}/${platform.language}`;
}
