import FeatureBadge from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import type {NavigationSection} from 'sentry/views/settings/types';

const organizationSettingsPathPrefix = '/settings/:orgId';
const userSettingsPathPrefix = '/settings/account';

const organizationNavigation: NavigationSection[] = [
  {
    name: t('User Settings'),
    items: [
      {
        path: `${userSettingsPathPrefix}/`,
        title: t('General Settings'),
        description: t('Configure general settings for your account'),
        id: 'user-settings',
      },
    ],
  },
  {
    name: t('Organization'),
    items: [
      {
        path: `${organizationSettingsPathPrefix}/`,
        title: t('General Settings'),
        index: true,
        description: t('Configure general settings for an organization'),
        id: 'general',
      },
      {
        path: `${organizationSettingsPathPrefix}/projects/`,
        title: t('Projects'),
        description: t("View and manage an organization's projects"),
        id: 'projects',
      },
      {
        path: `${organizationSettingsPathPrefix}/teams/`,
        title: t('Teams'),
        description: t("Manage an organization's teams"),
        id: 'teams',
      },
      {
        path: `${organizationSettingsPathPrefix}/members/`,
        title: t('Members'),
        description: t('Manage user membership for an organization'),
        id: 'members',
      },
      {
        path: `${organizationSettingsPathPrefix}/security-and-privacy/`,
        title: t('Security & Privacy'),
        description: t(
          'Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing)'
        ),
        id: 'security-and-privacy',
      },
      {
        path: `${organizationSettingsPathPrefix}/auth/`,
        title: t('Auth'),
        description: t('Configure single sign-on'),
        id: 'sso',
      },
      {
        path: `${organizationSettingsPathPrefix}/api-keys/`,
        title: t('API Keys'),
        show: ({access, features}) =>
          features!.has('api-keys') && access!.has('org:admin'),
        id: 'api-keys',
      },
      {
        path: `${organizationSettingsPathPrefix}/audit-log/`,
        title: t('Audit Log'),
        description: t('View the audit log for an organization'),
        id: 'audit-log',
      },
      {
        path: `${organizationSettingsPathPrefix}/rate-limits/`,
        title: t('Rate Limits'),
        show: ({features}) => features!.has('legacy-rate-limits'),
        description: t('Configure rate limits for all projects in the organization'),
        id: 'rate-limits',
      },
      {
        path: `${organizationSettingsPathPrefix}/relay/`,
        title: t('Relay'),
        description: t('Manage relays connected to the organization'),
        id: 'relay',
      },
      {
        path: `${organizationSettingsPathPrefix}/repos/`,
        title: t('Repositories'),
        description: t('Manage repositories connected to the organization'),
        id: 'repos',
      },
      {
        path: `${organizationSettingsPathPrefix}/integrations/`,
        title: t('Integrations'),
        description: t(
          'Manage organization-level integrations, including: Slack, Github, Bitbucket, Jira, and Azure DevOps'
        ),
        id: 'integrations',
        recordAnalytics: true,
      },
      {
        path: `${organizationSettingsPathPrefix}/early-features/`,
        title: t('Early Features'),
        description: t('Manage early access features'),
        badge: () => <FeatureBadge type="new" />,
        show: ({isSelfHosted}) => isSelfHosted || false,
        id: 'early-features',
        recordAnalytics: true,
      },
      {
        path: `${organizationSettingsPathPrefix}/dynamic-sampling/`,
        title: t('Dynamic Sampling'),
        description: t('Manage your sampling rate'),
        badge: () => <FeatureBadge type="alpha" />,
        show: ({organization}) =>
          !!organization && hasDynamicSamplingCustomFeature(organization),
      },
      {
        path: `${organizationSettingsPathPrefix}/feature-flags/`,
        title: t('Feature Flags'),
        description: t('Set up your provider webhooks'),
        badge: () => <FeatureBadge type="beta" />,
        show: ({organization}) =>
          !!organization && organization.features.includes('feature-flag-ui'),
      },
    ],
  },
  {
    name: t('Developer Settings'),
    items: [
      {
        path: `${organizationSettingsPathPrefix}/auth-tokens/`,
        title: t('Auth Tokens'),
        description: t('Manage organization auth tokens'),
        id: 'auth-tokens',
      },
      {
        path: `${organizationSettingsPathPrefix}/developer-settings/`,
        title: t('Custom Integrations'),
        description: t('Manage custom integrations'),
        id: 'developer-settings',
      },
    ],
  },
];

export default organizationNavigation;
