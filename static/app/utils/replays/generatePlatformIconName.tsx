import {getLogoImage} from 'sentry/components/events/contexts/contextIcon';
import {generateIconName} from 'sentry/components/events/contexts/utils';

/**
 * Generates names used for PlatformIcon. Translates ContextIcon names (https://sentry.sentry.io/stories/stories/shared/components/events/contexts/contexticon) to PlatformIcon (https://www.npmjs.com/package/platformicons) names
 */
export function generatePlatformIconName(
  name: string,
  version: string | undefined
): string {
  return getLogoImage(generateIconName(name, version)) ?? 'default';
}
