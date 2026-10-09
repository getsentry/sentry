import {Outlet, useLocation} from 'react-router';

import {useOrganization} from 'sentry/utils/useOrganization';

import {ContactBillingMembers} from 'getsentry/views/contactBillingMembers';

export function SubscriptionContext() {
  const organization = useOrganization();
  const location = useLocation();
  const isCancellationPreview =
    process.env.NODE_ENV === 'development' &&
    location.pathname.endsWith('/billing/cancel/') &&
    new URLSearchParams(location.search).has('preview');

  return organization.access.includes('org:billing') || isCancellationPreview ? (
    <Outlet context={isCancellationPreview} />
  ) : (
    <ContactBillingMembers />
  );
}
