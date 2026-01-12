import {t} from 'sentry/locale';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

const consoleSdkInvitesRoutes = (): SentryRouteObject =>
  ({
    path: 'console-sdk-invites/',
    name: t('Console SDK Invites'),
    component: make(() => import('sentry/views/settings/organizationConsoleSdkInvites')),
  }) as SentryRouteObject;

export default consoleSdkInvitesRoutes;
