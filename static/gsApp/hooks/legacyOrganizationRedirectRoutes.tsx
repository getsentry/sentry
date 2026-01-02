import type {SentryRouteObject} from 'sentry/router/types';

const legacyOrganizationRedirectRoutes = (): SentryRouteObject => ({
  children: [
    {
      path: 'support/',
      redirectTo: '/settings/:orgId/support/',
    },
    {
      path: 'billing/:splat/',
      redirectTo: '/settings/:orgId/billing/:splat/',
    },
    {
      path: 'billing/receipts/:invoiceGuid/',
      redirectTo: '/settings/:orgId/billing/receipts/:invoiceGuid/',
    },
    {
      path: 'subscription/redeem-code/',
      redirectTo: '/settings/:orgId/subscription/redeem-code/',
    },
    {
      path: 'subscription/:splat/',
      redirectTo: '/settings/:orgId/billing/:splat/',
    },
    {
      path: 'legal/',
      redirectTo: '/settings/:orgId/legal/',
    },
    {
      path: 'payments/',
      redirectTo: '/settings/:orgId/billing/receipts/',
    },
    {
      path: 'subscription/',
      redirectTo: '/settings/:orgId/billing/overview/',
    },
    {
      path: 'payments/:invoiceGuid/*',
      redirectTo: '/settings/:orgId/billing/receipts/:invoiceGuid/',
    },
  ],
});

export default legacyOrganizationRedirectRoutes;
