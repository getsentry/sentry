import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';
import errorHandler from 'sentry/utils/errorHandler';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';

import OrganizationSubscriptionContext from 'getsentry/components/organizationSubscriptionContext';

const rootRoutes = (): SentryRouteObject => ({
  children: [
    {
      // TODO(checkout v3): rename this to /checkout/ when the legacy checkout route is removed
      path: '/checkout/',
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
    {
      path: '/checkout/:orgId/',
      component: withDomainRedirect(errorHandler(OrganizationSubscriptionContext)),
      deprecatedRouteProps: true,
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
