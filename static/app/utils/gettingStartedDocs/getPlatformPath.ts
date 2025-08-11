import type {PlatformIntegration} from 'sentry/types/project';

export function getPlatformPath(platform: PlatformIntegration) {
  // handle console platforms (xbox, playstation, nintendo-switch, etc.)
  if (platform.type === 'console') {
    return `console/${platform.id}`;
  }

  // some platforms use a naming convention that combines 'language' and 'id' with a hyphen in between. For example, 'react-native'.
  if (platform.id === platform.language) {
    return `${platform.language}/${platform.language}`;
  }

  // splits the platform.id into language and framework, framework can have multiple words so we
  // only want to split it at the first hyphen
  const hyphenIndex = platform.id.indexOf('-');
  const framework =
    hyphenIndex === -1 ? undefined : platform.id.substring(hyphenIndex + 1);

  if (framework) {
    return `${platform.language}/${framework}`;
  }

  return `${platform.language}/${platform.language}`;
}
