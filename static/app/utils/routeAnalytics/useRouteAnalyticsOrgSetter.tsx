import {useContext, useEffect} from 'react';

import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteAnalyticsContext} from 'sentry/views/routeAnalyticsContextProvider';

/**
 * Sets the organization for route analytics events.
 * Only needs to be used once for the entire app just
 * below the Organization context.
 */
export default function useRouteAnalyticsOrgSetter() {
  const organization = useContext(OrganizationContext);
  const {setOrganization} = useContext(RouteAnalyticsContext);
  useEffect(() => {
    organization && setOrganization(organization);
  }, [organization, setOrganization]);
}
