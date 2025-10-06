import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import errorHandler from 'sentry/utils/errorHandler';

import OrganizationSubscriptionContext from 'getsentry/components/organizationSubscriptionContext';

const rootRoutes = (): SentryRouteObject => ({
  children: [
    {
      // TODO(checkout v3): rename this to /checkout/ when the legacy checkout route is removed
      path: '/checkout-v3/',
      component: errorHandler(OrganizationSubscriptionContext),
      deprecatedRouteProps: true,
      customerDomainOnlyRoute: true,
      children: [
        {
          index: true,
          component: make(() => import('getsentry/views/decideCheckout')),
        },
      ],
    },
  ],
});

export default rootRoutes;
