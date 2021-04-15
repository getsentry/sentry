import React from 'react';

import withOrganization from 'app/utils/withOrganization';

import OrganizationRateLimits from './organizationRateLimits';

const OrganizationRateLimitsContainer = (
  props: React.ComponentProps<typeof OrganizationRateLimits>
) => (!props.organization ? null : <OrganizationRateLimits {...props} />);

export default withOrganization(OrganizationRateLimitsContainer);
