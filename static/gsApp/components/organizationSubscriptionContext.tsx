import {Outlet} from 'react-router-dom';

import {OrganizationContainer} from 'sentry/views/organizationContainer';

import {SubscriptionContext} from 'getsentry/components/subscriptionContext';

export function OrganizationSubscriptionContext() {
  return (
    <OrganizationContainer>
      <SubscriptionContext>
        <Outlet />
      </SubscriptionContext>
    </OrganizationContainer>
  );
}
