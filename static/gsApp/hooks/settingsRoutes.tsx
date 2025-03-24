import {Fragment} from 'react';

import {IndexRedirect, IndexRoute, Redirect, Route} from 'sentry/components/route';
import {makeLazyloadComponent} from 'sentry/routes';
import errorHandler from 'sentry/utils/errorHandler';

import SubscriptionContext from 'getsentry/components/subscriptionContext';

// Shorthand to avoid extra line wrapping
const make = makeLazyloadComponent;

const settingsRoutes = () =>
  (
    <Fragment key="gs-routes-settings">
      <Redirect from="billing/history/" to="/settings/:orgId/billing/usage/" />
      <Redirect from="subscription/cancel/" to="/settings/:orgId/billing/cancel/" />

      <Route name="Subscription" path="billing/">
        <IndexRedirect to="overview/" />
        <Route
          path="checkout/"
          name="Change"
          component={errorHandler(SubscriptionContext)}
        >
          <IndexRoute component={make(() => import('../views/decideCheckout'))} />
        </Route>
        <Route path="cancel/" name="Cancel" component={errorHandler(SubscriptionContext)}>
          <IndexRoute component={make(() => import('../views/cancelSubscription'))} />
        </Route>
        <Route
          path="overview/"
          name="Overview"
          component={make(() => import('../views/subscriptionPage/overview'))}
        />
        <Route
          path="usage/"
          name="Usage History"
          component={make(() => import('../views/subscriptionPage/usageHistory'))}
        />
        <Route
          path="receipts/"
          name="Receipts"
          component={make(() => import('../views/subscriptionPage/paymentHistory'))}
        />
        <Route
          path="notifications/"
          name="Notifications"
          component={make(() => import('../views/subscriptionPage/notifications'))}
        />
        <Route
          path="details/"
          name="Billing Details"
          component={make(() => import('../views/subscriptionPage/billingDetails'))}
        />
        <Route
          path="usage-log/"
          name="Usage Log"
          component={make(() => import('../views/subscriptionPage/usageLog'))}
        />
        <Route
          path="receipts/:invoiceGuid/"
          name="Invoice Details"
          component={errorHandler(SubscriptionContext)}
        >
          <IndexRoute component={make(() => import('../views/invoiceDetails'))} />
        </Route>
      </Route>

      <Route
        path="spike-protection/"
        name="Spike Protection"
        component={make(() => import('../views/spikeProtection'))}
      />

      <Route
        path="subscription/spend-allocations/"
        name="Spend Allocations"
        component={make(() => import('../views/spendAllocations'))}
      />

      <Route
        path="subscription/redeem-code/"
        name="Redeem Promotional Code"
        component={make(() => import('../views/redeemPromoCode'))}
      />

      <Route
        path="legal/"
        name="Legal & Compliance"
        component={make(() => import('../views/legalAndCompliance/legalAndCompliance'))}
      />

      <Route
        name="Support"
        path="support/"
        component={() => {
          window.location.replace('https://sentry.zendesk.com/hc/en-us');
          return null;
        }}
      />
    </Fragment>
  ) as any; // TODO(ts): This does not play nicely with sentry's RoutesHook type

export default settingsRoutes;
