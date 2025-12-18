import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';
import errorHandler from 'sentry/utils/errorHandler';
import withDomainRedirect from 'sentry/utils/withDomainRedirect';
import withDomainRequired from 'sentry/utils/withDomainRequired';

import OrganizationSubscriptionContext from 'getsentry/components/organizationSubscriptionContext';

const rootRoutes = (): SentryRouteObject => ({
  children: [
    {
      path: '/checkout/',
      component: withDomainRequired(errorHandler(OrganizationSubscriptionContext)),
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
