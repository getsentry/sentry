import {OrganizationAvatar} from '@sentry/scraps/avatar';
import {InfoTip} from '@sentry/scraps/info';

import type {OrganizationSummary} from 'sentry/types/organization';

/**
 * How an organization appears as a menu item or select option: avatar, name,
 * and its status for organizations that are not active, e.g. pending deletion.
 */
export function getOrganizationItemProps(organization: OrganizationSummary) {
  return {
    label: organization.name,
    // The avatar goes in the leading slot, not the label, so these rows line up
    // with items that have icons instead of getting an empty slot before the badge.
    leadingItems: <OrganizationAvatar organization={organization} size={16} />,
    trailingItems:
      organization.status.id === 'active' ? undefined : (
        <InfoTip size="sm" title={organization.status.name} />
      ),
  };
}
