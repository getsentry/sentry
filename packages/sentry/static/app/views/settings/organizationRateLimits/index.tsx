import withOrganization from 'sentry/utils/withOrganization';

import OrganizationRateLimits from './organizationRateLimits';

const OrganizationRateLimitsContainer = (
  props: React.ComponentProps<typeof OrganizationRateLimits>
) => (!props.organization ? null : <OrganizationRateLimits {...props} />);

export default withOrganization(OrganizationRateLimitsContainer);
