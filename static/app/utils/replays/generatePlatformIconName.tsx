import {generateIconName} from 'sentry/components/events/contexts/utils';

const PLATFORM_ALIASES = {
  ios: 'apple',
  mac: 'apple',
  macos: 'apple',
  'mac-os-x': 'apple',
  darwin: 'apple',
  tvos: 'apple-tv',
  watchos: 'apple-watch',
  iphone: 'apple-iphone',
  ipad: 'apple-ipad',
  'legacy-edge': 'edge-legacy',
  'mobile-safari': 'safari',
  'chrome-mobile-ios': 'chrome',
  'google-chrome': 'chrome',
  'chrome-os': 'chrome',
  net: 'dotnet',
  'net-core': 'dotnetcore',
  'net-framework': 'dotnetframework',
};

/**
 * Generates names used for PlatformIcon. Translates ContextIcon names (https://sentry.sentry.io/stories/?name=app/components/events/contexts/contextIcon.stories.tsx) to PlatformIcon (https://www.npmjs.com/package/platformicons) names
 */
export function generatePlatformIconName(
  name: string,
  version: string | undefined
): string {
  const contextName = generateIconName(name, version);
  return contextName in PLATFORM_ALIASES ? PLATFORM_ALIASES[contextName] : contextName;
}
