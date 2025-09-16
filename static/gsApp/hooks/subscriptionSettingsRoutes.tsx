import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';

import settingsRoutes from 'getsentry/hooks/settingsRoutes';

const subscriptionSettingsRoutes = (): SentryRouteObject =>
  ({
    component: make(() => import('../components/subscriptionSettingsLayout')),
    children: [settingsRoutes()],
  }) as SentryRouteObject;

export default subscriptionSettingsRoutes;
