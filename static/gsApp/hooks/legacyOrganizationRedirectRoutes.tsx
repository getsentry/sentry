import {Fragment} from 'react';

import {Redirect} from 'sentry/components/route';

const legacyOrganizationRedirectRoutes = () =>
  (
    <Fragment key="gs-routes-legacy-organization-redirects">
      <Redirect from="support/" to="/settings/:orgId/support/" />
      <Redirect from="billing/:splat/" to="/settings/:orgId/billing/:splat/" />
      <Redirect
        from="billing/receipts/:invoiceGuid/"
        to="/settings/:orgId/billing/receipts/:invoiceGuid/"
      />
      <Redirect
        from="subscription/redeem-code/"
        to="/settings/:orgId/subscription/redeem-code/"
      />
      <Redirect from="subscription/:splat/" to="/settings/:orgId/billing/:splat/" />
      <Redirect from="legal/" to="/settings/:orgId/legal/" />
      <Redirect from="payments/" to="/settings/:orgId/billing/receipts/" />
      <Redirect from="subscription/" to="/settings/:orgId/billing/overview/" />
      <Redirect
        from="payments/:invoiceGuid/*"
        to="/settings/:orgId/billing/receipts/:invoiceGuid/"
      />
    </Fragment>
  ) as any; // TODO(ts): This does not play nicely with sentry's RoutesHook type

export default legacyOrganizationRedirectRoutes;
