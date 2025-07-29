import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';

export const authV2Routes: SentryRouteObject = {
  path: 'auth-v2/',
  children: [
    {
      index: true,
      component: make(() => import('sentry/views/authV2/pages/index')),
    },
  ],
};
