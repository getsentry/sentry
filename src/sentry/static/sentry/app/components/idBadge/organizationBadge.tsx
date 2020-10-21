import * as React from 'react';

import BaseBadge from 'app/components/idBadge/baseBadge';
import BadgeDisplayName from 'app/components/idBadge/badgeDisplayName';

type BaseBadgeProps = React.ComponentProps<typeof BaseBadge>;
type Organization = NonNullable<BaseBadgeProps['organization']>;

type Props = Partial<Omit<BaseBadgeProps, 'project' | 'organization' | 'team'>> & {
  // A full organization is not used, but required to satisfy types with
  // withOrganization()
  organization: Organization;
  // If true, will use default max-width, or specify one as a string
  hideOverflow?: boolean | string;
};

const OrganizationBadge = ({hideOverflow = true, organization, ...props}: Props) => (
  <BaseBadge
    displayName={
      <BadgeDisplayName hideOverflow={hideOverflow}>{organization.slug}</BadgeDisplayName>
    }
    organization={organization}
    {...props}
  />
);

export default OrganizationBadge;
