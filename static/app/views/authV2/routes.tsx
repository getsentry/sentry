import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

export const authV2Routes: SentryRouteObject = {
  component: make(() => import('sentry/views/authV2/brandedAuthLayout')),
  children: [
    {
      path: 'auth/login/:orgSlug?/',
      component: make(() => import('sentry/views/authV2/authLogin')),
    },
    {
      path: 'auth/register/',
      component: make(() => import('sentry/views/authV2/authRegister')),
    },
    {
      path: 'accept/:orgId/:memberId/:token/',
      component: make(() => import('sentry/views/authV2/acceptOrganizationInvite')),
    },
  ],
};
