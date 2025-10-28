import type {PlatformIntegration} from 'sentry/types/project';

/**
 * Platforms using new folder structure (platform/onboarding.tsx, platform/logs.tsx, etc.) instead of legacy (language/framework).
 */
const MIGRATED_PLATFORMS = new Set(['php-laravel']);

export function getPlatformPath(platform: PlatformIntegration) {
  // handle console platforms (xbox, playstation, nintendo-switch, etc.)
  if (platform.type === 'console') {
    return `console/${platform.id}`;
  }

  // Check if platform has been migrated to new structure
  if (MIGRATED_PLATFORMS.has(platform.id)) {
    return platform.id;
  }

  // Legacy structure for platforms not yet migrated
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
