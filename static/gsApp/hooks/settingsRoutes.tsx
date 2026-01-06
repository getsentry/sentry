import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';
import errorHandler from 'sentry/utils/errorHandler';

import SubscriptionContext from 'getsentry/components/subscriptionContext';

const settingsRoutes = (): SentryRouteObject => ({
  children: [
    {
      path: 'billing/history/',
      redirectTo: '/settings/:orgId/billing/usage/',
    },
    {
      path: 'subscription/cancel/',
      redirectTo: '/settings/:orgId/billing/cancel/',
    },
    {
      name: 'Subscription',
      path: 'billing/',
      children: [
        {
          index: true,
          redirectTo: 'overview/',
        },
        {
          path: 'checkout/',
          redirectTo: '/checkout/:orgId/',
        },
        {
          path: 'cancel/',
          name: 'Cancel',
          component: errorHandler(SubscriptionContext),
          deprecatedRouteProps: true,
          children: [
            {
              index: true,
              component: make(() => import('../views/cancelSubscription')),
            },
          ],
        },
        {
          path: 'overview/',
          name: 'Overview',
          component: make(() => import('../views/subscriptionPage/overview')),
        },
        {
          path: 'usage/',
          name: 'Usage History',
          component: make(() => import('../views/subscriptionPage/usageHistory')),
          deprecatedRouteProps: true,
        },
        {
          path: 'receipts/',
          name: 'Receipts',
          component: make(() => import('../views/subscriptionPage/paymentHistory')),
          deprecatedRouteProps: true,
        },
        {
          path: 'notifications/',
          name: 'Spend Notifications',
          component: make(() => import('../views/subscriptionPage/notifications')),
          deprecatedRouteProps: true,
        },
        {
          path: 'details/',
          name: 'Billing Information',
          component: make(() => import('../views/subscriptionPage/billingInformation')),
          deprecatedRouteProps: true,
        },
        // TODO(sub-v3): We're keeping both routes for now, but we should remove the usage-log route once we're confident in keeping the new name
        {
          path: 'usage-log/',
          name: 'Usage Log',
          component: make(() => import('../views/subscriptionPage/usageLog')),
          deprecatedRouteProps: true,
        },
        {
          path: 'activity-logs/',
          name: 'Activity Logs',
          component: make(() => import('../views/subscriptionPage/usageLog')),
          deprecatedRouteProps: true,
        },
        {
          path: 'receipts/:invoiceGuid/',
          name: 'Receipt Details',
          component: errorHandler(SubscriptionContext),
          deprecatedRouteProps: true,
          children: [
            {
              index: true,
              component: make(() => import('../views/invoiceDetails')),
              deprecatedRouteProps: true,
            },
          ],
        },
      ],
    },
    {
      path: 'spike-protection/',
      name: 'Spike Protection',
      component: make(() => import('../views/spikeProtection')),
    },
    {
      path: 'subscription/spend-allocations/',
      name: 'Spend Allocations',
      component: make(() => import('../views/spendAllocations')),
    },
    {
      path: 'subscription/redeem-code/',
      name: 'Redeem Promotional Code',
      component: make(() => import('../views/redeemPromoCode')),
      deprecatedRouteProps: true,
    },
    {
      path: 'legal/',
      name: 'Legal & Compliance',
      component: make(() => import('../views/legalAndCompliance/legalAndCompliance')),
      deprecatedRouteProps: true,
    },
    {
      name: 'Support',
      path: 'support/',
      component: () => {
        window.location.replace('https://sentry.zendesk.com/hc/en-us');
        return null;
      },
    },
  ],
});

export default settingsRoutes;
