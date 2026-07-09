import type {LocationDescriptor} from 'history';

import {ConfigStore} from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';

// If you change this also update the patterns in sentry.api.utils
const NORMALIZE_PATTERNS: Array<[pattern: RegExp, replacement: string]> = [
  // /organizations/slug/section, but not /organizations/new
  [/\/organizations\/(?!new)[^/]+\/(.*)/, '/$1'],
  // For /settings/:orgId/ -> /settings/organization/
  [
    /\/settings\/(?!account\/|billing\/|projects\/|teams\/|stats\/|seer\/)[^/]+\/?$/,
    '/settings/organization/',
  ],
  // Move /settings/:orgId/:section -> /settings/:section
  // but not /settings/organization or /settings/projects which is a new URL
  [
    /^\/?settings\/(?!account\/|billing\/|projects\/|teams\/|stats\/|seer\/)[^/]+\/(.*)/,
    '/settings/$1',
  ],
  [/^\/?join-request\/[^/]+\/?.*/, '/join-request/'],
  [/^\/?onboarding\/(?!setup-docs|select-platform|welcome)[^/]+\/(.*)/, '/onboarding/$1'],
  // Handles /org-slug/project-slug/getting-started/platform/ -> /getting-started/project-slug/platform/
  [/^\/?(?!settings)[^/]+\/([^/]+)\/getting-started\/(.*)/, '/getting-started/$1/$2'],
  [/^\/?accept-terms\/[^/]*\/?$/, '/accept-terms/'],
  [/^\/?checkout\/[^/]+\/(.*)/, '/checkout/$1'],
];

type NormalizeUrlWithCustomerDomainOptions = {
  /**
   * The active customer domain. When set (non-null) org/settings slugs are
   * stripped from the path.
   */
  customerDomain?: Config['customerDomain'];
  /**
   * Normalize regardless of whether a customer domain is provided. Used where a
   * slugless path is needed independent of the current domain (e.g. deriving
   * redirect targets, normalizing telemetry span names).
   */
  force?: boolean;
};

type NormalizeUrlOptions = {
  /**
   * Normalize regardless of whether a customer domain is active. See
   * {@link NormalizeUrlWithCustomerDomainOptions.force}.
   */
  forceCustomerDomain?: boolean;
};

/**
 * Pure version of {@link normalizeUrl}: normalize a URL using an explicitly
 * provided customer domain instead of reading it from global config. Prefer
 * `normalizeUrl` unless you need to supply the customer domain yourself (e.g.
 * in tests, or when normalizing for a domain other than the active one).
 */
export function normalizeUrlWithCustomerDomain(
  path: string,
  options?: NormalizeUrlWithCustomerDomainOptions
): string;

export function normalizeUrlWithCustomerDomain(
  path: LocationDescriptor,
  options?: NormalizeUrlWithCustomerDomainOptions
): LocationDescriptor;

export function normalizeUrlWithCustomerDomain(
  path: LocationDescriptor,
  options?: NormalizeUrlWithCustomerDomainOptions
): LocationDescriptor {
  if (!options?.force && !options?.customerDomain) {
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
    // @ts-expect-error TS(7022): 'replacement' implicitly has type 'any' because it... Remove this comment to see the full error message
    const replacement = resolved.pathname.replace(patternData[0], patternData[1]);
    if (replacement !== resolved.pathname) {
      return {...resolved, pathname: replacement};
    }
  }

  return resolved;
}

/**
 * Normalize a URL for customer domains based on the organization that was
 * present in the initial page load.
 *
 * Thin wrapper around {@link normalizeUrlWithCustomerDomain} that injects the
 * active customer domain from `ConfigStore`.
 */
export function normalizeUrl(path: string, options?: NormalizeUrlOptions): string;

export function normalizeUrl(
  path: LocationDescriptor,
  options?: NormalizeUrlOptions
): LocationDescriptor;

export function normalizeUrl(
  path: LocationDescriptor,
  options?: NormalizeUrlOptions
): LocationDescriptor {
  return normalizeUrlWithCustomerDomain(path, {
    customerDomain: ConfigStore.get('customerDomain'),
    force: options?.forceCustomerDomain,
  });
}
