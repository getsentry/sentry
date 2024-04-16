import withOrganization from 'sentry/utils/withOrganization';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

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
    <PermissionAlert />
  );
}

export default withOrganization(OrganizationRateLimitsContainer);
