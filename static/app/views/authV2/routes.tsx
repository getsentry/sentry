import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

export const authV2Routes: SentryRouteObject = {
  path: 'auth-v2/',
  children: [
    {
      index: true,
      component: make(() => import('sentry/views/authV2/pages/index')),
    },
  ],
};
