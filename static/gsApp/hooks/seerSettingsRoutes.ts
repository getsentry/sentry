import {t} from 'sentry/locale';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

export const seerSettingsRoutes = (): SentryRouteObject => ({
  path: 'seer/',
  name: t('Seer'),
  component: make(() => import('getsentry/views/seerAutomation/index')),
  children: [
    {
      path: 'trial/',
      component: make(() => import('getsentry/views/seerAutomation/trial')),
    },
    {
      index: true,
      component: make(() => import('getsentry/views/seerAutomation/seerAutomation')),
    },
    {
      path: 'scm/',
      component: make(() => import('getsentry/views/seerAutomation/scm')),
    },
    {
      path: 'projects/',
      component: make(() => import('getsentry/views/seerAutomation/projects')),
    },
    {
      path: 'repos/',
      component: make(() => import('getsentry/views/seerAutomation/repos')),
    },
    {
      path: 'repos/:repoId/',
      component: make(() => import('getsentry/views/seerAutomation/repoDetails')),
    },
    {
      path: 'onboarding/',
      name: t('Setup Wizard'),
      component: make(
        () => import('getsentry/views/seerAutomation/onboarding/onboarding')
      ),
    },
  ],
});
