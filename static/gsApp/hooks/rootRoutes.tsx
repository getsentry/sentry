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
      component: errorHandler(OrganizationSubscriptionContext),
      customerDomainOnlyRoute: true,
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          component: withDomainRequired(
            make(() => import('getsentry/views/decideCheckout'))
          ),
        },
      ],
    },
    {
      path: '/checkout/:orgId/',
      component: errorHandler(OrganizationSubscriptionContext),
      deprecatedRouteProps: true,
      children: [
        {
          index: true,
          component: withDomainRedirect(
            make(() => import('getsentry/views/decideCheckout'))
          ),
        },
      ],
    },
  ],
});

export default rootRoutes;
