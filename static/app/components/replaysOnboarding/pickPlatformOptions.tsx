import type {PlatformOption} from 'sentry/components/onboarding/gettingStartedDoc/types';

/**
 * Pick the platform options to display in the onboarding UI.
 * Returns siblingOption if it exists, otherwise packageManager.
 */
export function pickPlatformOptions(
  platformOptions?: Record<string, PlatformOption<any>>
):
  | Record<string, never>
  | {siblingOption: PlatformOption<any>}
  | {packageManager: PlatformOption<any>} {
  const {siblingOption, packageManager} = platformOptions || {};

  if (siblingOption) {
    return {siblingOption};
  }

  if (packageManager) {
    return {packageManager};
  }

  return {};
}
