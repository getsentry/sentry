import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import errorHandler from 'sentry/utils/errorHandler';

import OrganizationSubscriptionContext from 'getsentry/components/organizationSubscriptionContext';

const rootRoutes = (): SentryRouteObject => ({
  children: [
    {
      path: '/checkout/',
      component: errorHandler(OrganizationSubscriptionContext),
      deprecatedRouteProps: true,
      customerDomainOnlyRoute: true,
      children: [
        {
          index: true,
          component: make(() => import('../views/decideCheckout')),
          deprecatedRouteProps: true,
        },
      ],
    },
  ],
});

export default rootRoutes;
