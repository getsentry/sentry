import {Outlet} from 'sentry/router/reactRouter';
import {useOrganization} from 'sentry/utils/useOrganization';

import {ContactBillingMembers} from 'getsentry/views/contactBillingMembers';

export function SubscriptionContext() {
  const organization = useOrganization();
  return organization.access.includes('org:billing') ? (
    <Outlet />
  ) : (
    <ContactBillingMembers />
  );
}
