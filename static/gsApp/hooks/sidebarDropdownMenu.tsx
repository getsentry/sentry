import {Fragment} from 'react';

import SidebarMenuItem from 'sentry/components/sidebar/sidebarMenuItem';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

type Props = {
  organization: Organization;
};

/**
 * Hook for sidebar root dropdown menu to display Usage & Billing and Support
 * links
 */
export default function sidebarDropdownMenu(props: Props) {
  const {organization} = props;
  const hasBillingAccess = organization.access?.indexOf('org:billing') > -1;

  return (
    <Fragment key="sidebar:organization-dropdown-menu">
      {hasBillingAccess && (
        <SidebarMenuItem key="billing" to={`/settings/${organization.slug}/billing/`}>
          {t('Usage & Billing')}
        </SidebarMenuItem>
      )}
      <SidebarMenuItem key="support" href="https://sentry.zendesk.com/hc/en-us">
        {t('Support')}
      </SidebarMenuItem>
    </Fragment>
  );
}
