import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';

export const automationRoutes: SentryRouteObject = {
  path: 'alerts/',
  children: [
    {
      index: true,
      component: make(() => import('sentry/views/automations/list')),
    },
    {
      path: 'new',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/automations/new')),
        },
      ],
    },
    {
      path: ':automationId/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/automations/detail')),
        },
        {
          path: 'edit/',
          component: make(() => import('sentry/views/automations/edit')),
        },
      ],
    },
  ],
};
