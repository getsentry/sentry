import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

export const authV2Routes: SentryRouteObject = {
  children: [
    {
      component: make(() => import('sentry/views/authV2/plainAuthLayout')),
      children: [
        {
          path: 'oauth/authorize/',
          component: make(() => import('sentry/views/authV2/oauthAuthorize')),
        },
        {
          path: 'oauth/device/',
          component: make(() => import('sentry/views/authV2/oauthDevice')),
        },
      ],
    },
    {
      component: make(() => import('sentry/views/authV2/brandedAuthLayout')),
      children: [
        {
          path: 'account/recover/confirm/:userId/:token/',
          component: make(() => import('sentry/views/authV2/passwordReset')),
        },
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
    },
  ],
};
