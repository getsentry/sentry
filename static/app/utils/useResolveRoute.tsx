import {useContext} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {OrganizationSummary} from 'sentry/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

import shouldUseLegacyRoute from './shouldUseLegacyRoute';

/**
 * If organization is passed, then a URL with the route will be returned with the customer domain prefix attached if the
 * organization has customer domain feature enabled.
 * Otherwise, if the organization is not given, then if the current organization has customer domain enabled, then we
 * use the sentry URL as the prefix.
 */
function useResolveRoute(route: string, organization?: OrganizationSummary) {
  const {sentryUrl} = ConfigStore.get('links');
  const currentOrganization = useContext(OrganizationContext);
  const hasCustomerDomain = currentOrganization?.features.includes('customer-domains');

  if (!organization) {
    if (hasCustomerDomain) {
      return `${sentryUrl}${route}`;
    }
    return route;
  }

  const {organizationUrl} = organization.links;

  const useLegacyRoute = shouldUseLegacyRoute(organization);
  if (useLegacyRoute) {
    if (hasCustomerDomain) {
      // If the current org is a customer domain, then we need to change the hostname in addition to
      // updating the path.

      return `${sentryUrl}${route}`;
    }
    return route;
  }
  return `${organizationUrl}${route}`;
}

export default useResolveRoute;
