import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

export const detectorRoutes: SentryRouteObject = {
  path: 'monitors/',
  children: [
    {
      index: true,
      component: make(() => import('sentry/views/detectors/list/allMonitors')),
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
