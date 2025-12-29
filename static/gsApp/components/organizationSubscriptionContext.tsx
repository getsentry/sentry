import type React from 'react';

import {OrganizationContainer} from 'sentry/views/organizationContainer';

import SubscriptionContext from 'getsentry/components/subscriptionContext';

type Props = {
  children: React.JSX.Element;
};

function OrganizationSubscriptionContext({children}: Props) {
  return (
    <OrganizationContainer>
      <SubscriptionContext>{children}</SubscriptionContext>
    </OrganizationContainer>
  );
}

export default OrganizationSubscriptionContext;
