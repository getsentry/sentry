import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import errorHandler from 'sentry/utils/errorHandler';

import OrganizationSubscriptionContext from 'getsentry/components/organizationSubscriptionContext';

const rootRoutes = (): SentryRouteObject => ({
  children: [
    {
      // TODO(checkout v3): change this to the correct path (/settings/billing/checkout/)
      // when GA'd
      path: '/checkout-v3/',
      component: errorHandler(OrganizationSubscriptionContext),
      deprecatedRouteProps: true,
      customerDomainOnlyRoute: true,
      children: [
        {
          index: true,
          component: make(() => import('../views/decideCheckout')),
          deprecatedRouteProps: true,
        },
        {
          path: 'success/',
          component: make(() => import('../views/amCheckout/checkoutSuccess')),
          deprecatedRouteProps: true,
        },
      ],
    },
  ],
});

export default rootRoutes;
