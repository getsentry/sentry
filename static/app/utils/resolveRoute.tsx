import {DEPLOY_PREVIEW_CONFIG} from 'sentry/constants';
import {ConfigStore} from 'sentry/stores/configStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import {extractSlug} from 'sentry/utils/extractSlug';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

/**
 * In pnpm dev-ui mode we proxy API calls to sentry.io.
 * However, browser URLs are in the form of acme.dev.getsentry.net.
 * In order to not redirect to production we swap domains.
 */
function localizeDomain(domain?: string) {
  if (!window.__SENTRY_DEV_UI || !domain) {
    return domain;
  }
  const slugDomain = extractSlug(window.location.host);

  // A Vercel preview or a proxy host is the only host the browser can reach us
  // on, so we stay put rather than sending the user to production. An `acme---`
  // prefix is an explicit organization on exactly those hosts though, and
  // outranks this -- without it there is nowhere else to go.
  if (
    slugDomain?.separator !== '---' &&
    (DEPLOY_PREVIEW_CONFIG || window.__SENTRY_DEV_UI_PROXY_HOST)
  ) {
    return `https://${window.location.host}`;
  }

  if (!slugDomain) {
    return domain;
  }

  // Swap sentry.io for the host we're being served from. A leading dot means
  // there is an organization in front of it, which has to be reattached with
  // whichever separator this host uses -- `acme.localhost:7999`, but
  // `acme---dev-ui--ws--owner.coder.sentry.dev`.
  return domain.replace(/(\.)?sentry\.io/, (_match, dot) =>
    dot ? `${slugDomain.separator}${slugDomain.domain}` : slugDomain.domain
  );
}

/**
 * Decide if an organization uses slug based paths.
 */
function shouldUseSlugPath(organization: OrganizationSummary): boolean {
  const {organizationUrl} = organization.links;

  return !organizationUrl || !ConfigStore.get('features').has('system:multi-region');
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
  _currentOrganization: OrganizationSummary | null,
  organization?: OrganizationSummary
) {
  const hasCustomerDomain = ConfigStore.get('features').has('system:multi-region');
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
