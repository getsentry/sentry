import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

export const authV2Routes: SentryRouteObject = {
  path: 'auth/',
  component: make(() => import('sentry/views/authV2/brandedAuthLayout')),
  children: [
    {
      path: 'login/:orgSlug?/',
      component: make(() => import('sentry/views/authV2/authLogin')),
    },
  ],
};
