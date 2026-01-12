import {t} from 'sentry/locale';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

const consoleSdkInvitesRoutes = (): SentryRouteObject =>
  ({
    path: 'console-sdk-invites/',
    name: t('Console SDK Invites'),
    component: make(() => import('getsentry/views/consoleSdkInvites')),
  }) as SentryRouteObject;

export default consoleSdkInvitesRoutes;
