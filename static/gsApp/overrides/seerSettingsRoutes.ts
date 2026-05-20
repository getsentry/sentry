import {t} from 'sentry/locale';
import {makeLazyloadComponent as make} from 'sentry/makeLazyloadComponent';
import type {SentryRouteObject} from 'sentry/router/types';

export const seerSettingsRoutes = (): SentryRouteObject => ({
  path: 'seer/',
  name: t('Seer'),
  component: make(() => import('getsentry/views/seerAutomation/index')),
  children: [
    {
      // If legacy or seat-based is active, redirects to /seer/
      path: 'trial/',
      component: make(() => import('getsentry/views/seerAutomation/trial')),
    },
    {
      // Legacy onboarding, seat-based redirects to /seer/
      path: 'onboarding/',
      name: t('Setup Wizard'),
      component: make(
        () => import('getsentry/views/seerAutomation/onboarding/onboarding')
      ),
    },
    {
      // Legacy autofix page, redirects to /seer/projects/ if seat-based is active
      index: true,
      name: t('Seer Automation'),
      component: make(() => import('getsentry/views/seerAutomation/seerAutomation')),
    },
    {
      // Legacy orgs will skip this check
      component: make(() => import('getsentry/views/seerAutomation/scmRequired')),
      children: [
        {
          path: 'projects/',
          name: t('Autofix'),
          component: make(() => import('getsentry/views/seerAutomation/projects')),
          children: [
            {
              path: ':projectSlug/',
              name: t('Project Details'),
              component: make(
                () => import('getsentry/views/seerAutomation/projectFlyout')
              ),
            },
            {
              path: 'defaults/',
              name: t('Defaults'),
              component: make(
                () => import('getsentry/views/seerAutomation/projectDefaults')
              ),
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
              component: make(
                () => import('getsentry/views/seerAutomation/repoDefaults')
              ),
            },
          ],
        },
        {
          path: 'advanced/',
          name: t('Advanced Settings'),
          component: make(() => import('getsentry/views/seerAutomation/advanced')),
        },
      ],
    },
  ],
});
