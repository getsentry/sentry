import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';

import settingsRoutes from 'getsentry/hooks/settingsRoutes';

const SubscriptionSettingsRoutes: SentryRouteObject = {
  component: make(() => import('../components/subscriptionSettingsLayout')),
  deprecatedRouteProps: true,
  children: [settingsRoutes()],
};

export default SubscriptionSettingsRoutes;
