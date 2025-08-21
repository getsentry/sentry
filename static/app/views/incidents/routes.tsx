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
      path: ':caseId/',
      component: make(() => import('sentry/views/incidents/caseDetails')),
    },
  ],
};
