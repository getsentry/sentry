import withOrganization from 'sentry/utils/withOrganization';

import OrganizationRateLimits from './organizationRateLimits';

function OrganizationRateLimitsContainer(
  props: React.ComponentProps<typeof OrganizationRateLimits>
) {
  return !props.organization ? null : <OrganizationRateLimits {...props} />;
}

export default withOrganization(OrganizationRateLimitsContainer);
