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
      name: t('Overview'),
      component: make(() => import('getsentry/views/seerAutomation/seerAutomation')),
    },
    {
      path: 'scm/',
      name: t('Repositories'),
      component: make(() => import('getsentry/views/seerAutomation/scm')),
    },
    {
      path: 'projects/',
      name: t('Autofix'),
      component: make(() => import('getsentry/views/seerAutomation/projects')),
      children: [
        {
          path: 'defaults/',
          name: t('Defaults'),
          component: make(() => import('getsentry/views/seerAutomation/projectDefaults')),
        },
      ],
    },
    {
      path: 'repos/',
      name: t('Code Review'),
      component: make(() => import('getsentry/views/seerAutomation/repos')),
      children: [
        {
          path: ':repoId/',
          name: t('Repository Details'),
          component: make(() => import('getsentry/views/seerAutomation/repoDetails')),
        },
        {
          path: 'defaults/',
          name: t('Defaults'),
          component: make(() => import('getsentry/views/seerAutomation/repoDefaults')),
        },
      ],
    },
    {
      path: 'advanced/',
      name: t('Advanced Settings'),
      component: make(() => import('getsentry/views/seerAutomation/advanced')),
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
