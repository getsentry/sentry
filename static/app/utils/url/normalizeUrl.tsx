import type {Location, LocationDescriptor} from 'history';

import ConfigStore from 'sentry/stores/configStore';

// If you change this also update the patterns in sentry.api.utils
const NORMALIZE_PATTERNS: Array<[pattern: RegExp, replacement: string]> = [
  // /organizations/slug/section, but not /organizations/new
  [/\/organizations\/(?!new)[^\/]+\/(.*)/, '/$1'],
  // For /settings/:orgId/ -> /settings/organization/
  [
    /\/settings\/(?!account\/|billing\/|projects\/|teams\/)[^\/]+\/?$/,
    '/settings/organization/',
  ],
  // Move /settings/:orgId/:section -> /settings/:section
  // but not /settings/organization or /settings/projects which is a new URL
  [
    /^\/?settings\/(?!account\/|billing\/|projects\/|teams\/)[^\/]+\/(.*)/,
    '/settings/$1',
  ],
  [/^\/?join-request\/[^\/]+\/?.*/, '/join-request/'],
  [
    /^\/?onboarding\/(?!setup-docs|select-platform|welcome)[^\/]+\/(.*)/,
    '/onboarding/$1',
  ],
  // Handles /org-slug/project-slug/getting-started/platform/ -> /getting-started/project-slug/platform/
  [/^\/?(?!settings)[^\/]+\/([^\/]+)\/getting-started\/(.*)/, '/getting-started/$1/$2'],
  [/^\/?accept-terms\/[^\/]*\/?$/, '/accept-terms/'],
];

type NormalizeUrlOptions = {
  forceCustomerDomain: boolean;
};

/**
 * Normalize a URL for customer domains based on the organization that was
 * present in the initial page load.
 */
export default function normalizeUrl(path: string, options?: NormalizeUrlOptions): string;

export default function normalizeUrl(
  path: LocationDescriptor,
  options?: NormalizeUrlOptions
): LocationDescriptor;

export default function normalizeUrl(
  path: LocationDescriptor,
  location?: Location,
  options?: NormalizeUrlOptions
): LocationDescriptor;

export default function normalizeUrl(
  path: LocationDescriptor,
  location?: Location | NormalizeUrlOptions,
  options?: NormalizeUrlOptions
): LocationDescriptor {
  if (location && 'forceCustomerDomain' in location) {
    options = location;
    location = undefined;
  }

  const customerDomain = ConfigStore.get('customerDomain');
  if (!options?.forceCustomerDomain && !customerDomain) {
    return path;
  }

  let resolved = path;

  if (typeof resolved === 'string') {
    for (const patternData of NORMALIZE_PATTERNS) {
      resolved = resolved.replace(patternData[0], patternData[1]);
      if (resolved !== path) {
        return resolved;
      }
    }
    return resolved;
  }

  if (!resolved.pathname) {
    return resolved;
  }

  for (const patternData of NORMALIZE_PATTERNS) {
    // @ts-ignore TS(7022): 'replacement' implicitly has type 'any' because it... Remove this comment to see the full error message
    const replacement = resolved.pathname.replace(patternData[0], patternData[1]);
    if (replacement !== resolved.pathname) {
      return {...resolved, pathname: replacement};
    }
  }

  return resolved;
}
