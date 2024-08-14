import type {Organization} from 'sentry/types/organization';

import BadgeDisplayName from './badgeDisplayName';
import {BaseBadge, type BaseBadgeProps} from './baseBadge';

export interface OrganizationBadgeProps extends BaseBadgeProps {
  organization: Organization;
  /**
   * When true will default max-width, or specify one as a string
   */
  hideOverflow?: boolean | string;
}

function OrganizationBadge({
  hideOverflow = true,
  organization,
  ...props
}: OrganizationBadgeProps) {
  return (
    <BaseBadge
      displayName={
        <BadgeDisplayName hideOverflow={hideOverflow}>
          {organization.slug}
        </BadgeDisplayName>
      }
      organization={organization}
      {...props}
    />
  );
}

export default OrganizationBadge;
