import withOrganization from 'sentry/utils/withOrganization';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

import OrganizationRateLimits from './organizationRateLimits';

function OrganizationRateLimitsContainer(
  props: React.ComponentProps<typeof OrganizationRateLimits>
) {
  if (!props.organization) {
    return null;
  }

  return props.organization.access.includes('org:write') ? (
    <OrganizationRateLimits {...props} />
  ) : (
    <OrganizationPermissionAlert margin={false} />
  );
}

export default withOrganization(OrganizationRateLimitsContainer);
