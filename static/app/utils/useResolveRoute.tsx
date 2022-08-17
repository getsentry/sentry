import ConfigStore from 'sentry/stores/configStore';
import {OrganizationSummary} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

import shouldUseLegacyRoute from './shouldUseLegacyRoute';

function useResolveRoute(organization: OrganizationSummary, route: string) {
  const currentOrganization = useOrganization();
  const {links} = organization;
  const {organizationUrl} = links;

  const useLegacyRoute = shouldUseLegacyRoute(organization);
  if (useLegacyRoute) {
    if (currentOrganization.features.includes('customer-domains')) {
      // If the current org is a customer domain, then we need to change the hostname in addition to
      // updating the path.
      const {sentryUrl} = ConfigStore.get('links');
      return `${sentryUrl}${route}`;
    }
    return route;
  }
  return `${organizationUrl}${route}`;
}

export default useResolveRoute;
