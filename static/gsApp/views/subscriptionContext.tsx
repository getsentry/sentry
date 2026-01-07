import {Outlet} from 'react-router-dom';

import useOrganization from 'sentry/utils/useOrganization';

import ContactBillingMembers from 'getsentry/views/contactBillingMembers';

export default function SubscriptionContext() {
  const organization = useOrganization();
  return organization.access.includes('org:billing') ? (
    <Outlet />
  ) : (
    <ContactBillingMembers />
  );
}
