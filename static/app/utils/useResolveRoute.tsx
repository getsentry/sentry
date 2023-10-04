import {DEPLOY_PREVIEW_CONFIG} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {OrganizationSummary} from 'sentry/types';
import {extractSlug} from 'sentry/utils/extractSlug';

import shouldUseLegacyRoute from './shouldUseLegacyRoute';
import useOrganization from './useOrganization';
import {normalizeUrl} from './withDomainRequired';

/**
 * In yarn dev-ui mode we proxy API calls to sentry.io.
 * However, all of the browser URLs are either acme.localhost,
 * or acme.dev.getsentry.net so we need to hack up the server provided
 * domain values.
 */
function localizeDomain(domain?: string) {
  if (!window.__SENTRY_DEV_UI || !domain) {
    return domain;
  }
  // Vercel doesn't support subdomains, so stay on the current host.
  if (DEPLOY_PREVIEW_CONFIG) {
    return `https://${window.location.host}`;
  }

  const slugDomain = extractSlug(window.location.host);
  if (!slugDomain) {
    return domain;
  }
  return domain.replace('sentry.io', slugDomain.domain);
}

/**
 * If organization is passed, then a URL with the route will be returned with the customer domain prefix attached if the
 * organization has customer domain feature enabled.
 *
 * Otherwise, if the organization is not given, then if the current organization has customer domain enabled, then we
 * use the sentry URL as the prefix.
 */
function useResolveRoute(route: string, organization?: OrganizationSummary) {
  const currentOrganization = useOrganization({allowNull: true});
  const hasCustomerDomain = currentOrganization?.features.includes('customer-domains');
  const sentryUrl = localizeDomain(ConfigStore.get('links').sentryUrl);

  if (!organization) {
    if (hasCustomerDomain) {
      return `${sentryUrl}${normalizeUrl(route)}`;
    }
    return route;
  }

  const organizationUrl = localizeDomain(organization.links.organizationUrl);

  const useLegacyRoute = shouldUseLegacyRoute(organization);
  if (useLegacyRoute) {
    if (hasCustomerDomain) {
      // If the current org is a customer domain, then we need to change the hostname in addition to
      // updating the path.

      return `${sentryUrl}${route}`;
    }
    return route;
  }
  return `${organizationUrl}${normalizeUrl(route)}`;
}

export default useResolveRoute;
