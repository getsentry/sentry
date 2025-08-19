import type {SentryRouteObject} from 'sentry/components/route';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';

export const incidentRoutes: SentryRouteObject = {
  path: 'incidents/',
  children: [
    {
      index: true,
      component: make(() => import('sentry/views/incidents/hub')),
    },
    {
      path: 'setup/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/incidents/caseSetup')),
        },
        {
          path: 'template/',
          component: make(() => import('sentry/views/incidents/templateSetup')),
        },
      ],
    },
    {
      path: ':caseId/',
      children: [
        {
          index: true,
          component: make(() => import('sentry/views/incidents/caseDetails')),
        },
        {
          path: 'edit/',
          component: make(() => import('sentry/views/incidents/caseSetup')),
        },
      ],
    },
  ],
};
