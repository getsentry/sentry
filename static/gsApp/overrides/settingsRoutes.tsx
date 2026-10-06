import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';
import {errorHandler} from 'sentry/utils/errorHandler';

import {SubscriptionContext} from 'getsentry/views/subscriptionContext';

export const settingsRoutes = (): SentryRouteObject => ({
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
          children: [
            {
              index: true,
              component: make(() => import('getsentry/views/cancelSubscription')),
            },
          ],
        },
        {
          path: 'overview/',
          name: 'Overview',
          component: make(() => import('getsentry/views/subscriptionPage/overview')),
        },
        {
          path: 'usage/',
          name: 'Usage History',
          component: make(() => import('getsentry/views/subscriptionPage/usageHistory')),
        },
        {
          path: 'receipts/',
          name: 'Receipts',
          component: make(
            () => import('getsentry/views/subscriptionPage/paymentHistory')
          ),
        },
        {
          path: 'notifications/',
          name: 'Spend Notifications',
          component: make(() => import('getsentry/views/subscriptionPage/notifications')),
        },
        {
          path: 'details/',
          name: 'Billing Information',
          component: make(
            () => import('getsentry/views/subscriptionPage/billingInformation')
          ),
        },
        // TODO(sub-v3): We're keeping both routes for now, but we should remove the usage-log route once we're confident in keeping the new name
        {
          path: 'usage-log/',
          name: 'Usage Log',
          component: make(() => import('getsentry/views/subscriptionPage/usageLog')),
        },
        {
          path: 'activity-logs/',
          name: 'Activity Logs',
          component: make(() => import('getsentry/views/subscriptionPage/usageLog')),
        },
        {
          path: 'receipts/:invoiceGuid/',
          name: 'Receipt Details',
          component: errorHandler(SubscriptionContext),
          children: [
            {
              index: true,
              component: make(() => import('getsentry/views/invoiceDetails')),
            },
          ],
        },
      ],
    },
    {
      path: 'spike-protection/',
      name: 'Spike Protection',
      component: make(() => import('getsentry/views/spikeProtection')),
    },
    {
      path: 'subscription/spend-allocations/',
      name: 'Spend Allocations',
      component: make(() => import('getsentry/views/spendAllocations')),
    },
    {
      path: 'subscription/redeem-code/',
      name: 'Redeem Promotional Code',
      component: make(() => import('getsentry/views/redeemPromoCode')),
    },
    {
      path: 'legal/',
      name: 'Legal & Compliance',
      component: make(
        () => import('getsentry/views/legalAndCompliance/legalAndCompliance')
      ),
    },
    {
      name: 'Support',
      path: 'support/',
      component: () => {
        window.location.replace('https://www.sentry.help');
        return null;
      },
    },
  ],
});
