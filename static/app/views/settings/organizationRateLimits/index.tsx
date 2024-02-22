import withOrganization from 'sentry/utils/withOrganization';
import PermissionAlert from 'sentry/views/settings/organization/permissionAlert';

import OrganizationRateLimits from './organizationRateLimits';

function OrganizationRateLimitsContainer(
  props: React.ComponentProps<typeof OrganizationRateLimits>
) {
  const {organization} = props;
  if (!organization) {
    return null;
  }

  return organization.access.includes('org:write') ? (
    <OrganizationRateLimits {...props} />
  ) : (
    <PermissionAlert />
  );
}

export default withOrganization(OrganizationRateLimitsContainer);
