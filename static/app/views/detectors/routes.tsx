import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';

export const detectorRoutes: SentryRouteObject = {
  path: 'monitors/',
  children: [
    {
      index: true,
      component: make(() => import('sentry/views/detectors/list')),
    },
    {
      path: 'new',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/detectors/new')),
        },
        {
          path: 'settings/',
          component: make(() => import('sentry/views/detectors/new-settings')),
        },
      ],
    },
    {
      path: ':detectorId/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/detectors/detail')),
        },
        {
          path: 'edit/',
          component: make(() => import('sentry/views/detectors/edit')),
        },
      ],
    },
  ],
};
