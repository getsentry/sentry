import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

import {settingsRoutes} from 'getsentry/overrides/settingsRoutes';

export const subscriptionSettingsRoutes = (): SentryRouteObject => ({
  component: make(() => import('getsentry/components/subscriptionSettingsLayout')),
  children: [settingsRoutes()],
});
