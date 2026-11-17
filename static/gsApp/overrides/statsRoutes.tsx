import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

export const statsRoutes = (): SentryRouteObject => ({
  path: 'seer/',
  component: make(() => import('getsentry/views/seerCostStats')),
});
