import type {RouteComponent, RouteComponentProps} from 'react-router';
import type {Location, LocationDescriptor} from 'history';
import trimEnd from 'lodash/trimEnd';
import trimStart from 'lodash/trimStart';

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
  [/^\/?onboarding\/[^\/]+\/(.*)/, '/onboarding/$1'],
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
export function normalizeUrl(path: string, options?: NormalizeUrlOptions): string;

export function normalizeUrl(
  path: LocationDescriptor,
  options?: NormalizeUrlOptions
): LocationDescriptor;

export function normalizeUrl(
  path: LocationDescriptor,
  location?: Location,
  options?: NormalizeUrlOptions
): LocationDescriptor;

export function normalizeUrl(
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
    const replacement = resolved.pathname.replace(patternData[0], patternData[1]);
    if (replacement !== resolved.pathname) {
      return {...resolved, pathname: replacement};
    }
  }

  return resolved;
}

/**
 * withDomainRequired is a higher-order component (HOC) meant to be used with <Route /> components within
 * static/app/routes.tsx whose route paths do not contain the :orgId parameter.
 * For example:
 *
 *  <Route
 *    path="/issues/(searches/:searchId/)"
 *    component={withDomainRequired(errorHandler(IssueListContainer))}
 *  / >
 *
 * withDomainRequired ensures that the route path is only accessed whenever a customer domain is used.
 * For example: orgslug.sentry.io
 *
 * The side-effect that this HOC provides is that it'll redirect the browser to sentryUrl
 * (from ConfigStore.getState().links) whenever one of the following conditions are not satisfied:
 *
 * - ConfigStore.getState().customerDomain is present.
 * - ConfigStore.getState().features contains system:multi-region feature.
 *
 * If both conditions above are satisfied, then WrappedComponent will be rendered with orgId included in the route
 * params prop.
 *
 * Whenever https://orgslug.sentry.io/ is accessed in the browser, then both conditions above will be satisfied.
 */
function withDomainRequired<P extends RouteComponentProps<{}, {}>>(
  WrappedComponent: RouteComponent
) {
  return function withDomainRequiredWrapper(props: P) {
    const {params} = props;
    const {features, customerDomain, links} = ConfigStore.getState();
    const {sentryUrl} = links;

    const hasCustomerDomain = features.has('system:multi-region');

    if (!customerDomain || !hasCustomerDomain) {
      // This route should only be accessed if a customer domain is used.
      // We redirect the user to the sentryUrl.
      const redirectPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const redirectURL = `${trimEnd(sentryUrl, '/')}/${trimStart(redirectPath, '/')}`;
      window.location.replace(redirectURL);
      return null;
    }

    const newParams = {
      ...params,
      orgId: customerDomain.subdomain,
    };

    return <WrappedComponent {...props} params={newParams} />;
  };
}

export default withDomainRequired;
