import {DEPLOY_PREVIEW_CONFIG} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {OrganizationSummary} from 'sentry/types';
import {extractSlug} from 'sentry/utils/extractSlug';

import {normalizeUrl} from './withDomainRequired';

/**
 * In yarn dev-ui mode we proxy API calls to sentry.io.
 * However, browser URLs are in the form of acme.dev.getsentry.net.
 * In order to not redirect to production we swap domains.
 */
function localizeDomain(domain?: string) {
  if (!window.__SENTRY_DEV_UI || !domain) {
    return domain;
  }
  // Vercel doesn't support subdomains, stay on the current host.
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
 * Decide if an organization uses slug based paths.
 */
function shouldUseSlugPath(organization: OrganizationSummary): boolean {
  const {organizationUrl} = organization.links;
  return !organizationUrl || !organization.features.includes('customer-domains');
}

/**
 * If organization is passed, then a URL with the route will be returned with the customer domain prefix attached if the
 * organization has customer domain feature enabled.
 *
 * Otherwise, if the organization is not given, then if the current organization has customer domain enabled, then we
 * use the sentry URL as the prefix.
 */
function resolveRoute(
  route: string,
  currentOrganization: OrganizationSummary | null,
  organization?: OrganizationSummary
) {
  const hasCustomerDomain = currentOrganization?.features.includes('customer-domains');
  const sentryUrl = localizeDomain(ConfigStore.get('links').sentryUrl);

  // If only one organization was provided we're not switching orgs,
  // and thus not switching domains.
  if (!organization) {
    return normalizeUrl(route);
  }

  const organizationUrl = localizeDomain(organization.links.organizationUrl);
  const useSlugPath = shouldUseSlugPath(organization);
  if (useSlugPath) {
    if (hasCustomerDomain) {
      // If the current org is a customer domain, then we need to change the hostname in addition to
      // updating the path.

      return `${sentryUrl}${route}`;
    }
    return route;
  }
  return `${organizationUrl}${normalizeUrl(route)}`;
}

export {localizeDomain, resolveRoute};
