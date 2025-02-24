import FeatureBadge from 'sentry/components/badge/featureBadge';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import type {Organization} from 'sentry/types/organization';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import type {NavigationSection} from 'sentry/views/settings/types';

const organizationSettingsPathPrefix = '/settings/:orgId';
const userSettingsPathPrefix = '/settings/account';

export function getUserOrgNavigationConfiguration({
  organization: incomingOrganization,
}: {
  organization: Organization;
}): NavigationSection[] {
  return [
    {
      name: t('Account'),
      items: [
        {
          path: `${userSettingsPathPrefix}/details/`,
          title: t('Account Details'),
          description: t(
            'Change your account details and preferences (e.g. timezone/clock, avatar, language)'
          ),
        },
        {
          path: `${userSettingsPathPrefix}/security/`,
          title: t('Security'),
          description: t('Change your account password and/or two factor authentication'),
        },
        {
          path: `${userSettingsPathPrefix}/notifications/`,
          title: t('Notifications'),
          description: t('Configure what email notifications to receive'),
        },
        {
          path: `${userSettingsPathPrefix}/emails/`,
          title: t('Email Addresses'),
          description: t(
            'Add or remove secondary emails, change your primary email, verify your emails'
          ),
        },
        {
          path: `${userSettingsPathPrefix}/subscriptions/`,
          title: t('Subscriptions'),
          description: t(
            'Change Sentry marketing subscriptions you are subscribed to (GDPR)'
          ),
        },
        {
          path: `${userSettingsPathPrefix}/authorizations/`,
          title: t('Authorized Applications'),
          description: t(
            'Manage third-party applications that have access to your Sentry account'
          ),
        },
        {
          path: `${userSettingsPathPrefix}/identities/`,
          title: t('Identities'),
          description: t(
            'Manage your third-party identities that are associated to Sentry'
          ),
        },
        {
          path: `${userSettingsPathPrefix}/close-account/`,
          title: t('Close Account'),
          description: t('Permanently close your Sentry account'),
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
            (features?.has('api-keys') && access?.has('org:admin')) ?? false,
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
          show: ({features}) => features?.has('legacy-rate-limits') ?? false,
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
          badge: () => 'alpha',
          show: ({organization}) =>
            !!organization && hasDynamicSamplingCustomFeature(organization),
        },
        {
          path: `${organizationSettingsPathPrefix}/feature-flags/`,
          title: t('Feature Flags'),
          description: t('Set up your provider webhooks'),
          badge: () => 'beta',
          show: ({organization}) =>
            !!organization && organization.features.includes('feature-flag-ui'),
        },
        {
          path: `${organizationSettingsPathPrefix}/stats/`,
          title: t('Stats & Usage'),
          description: t('View organization stats and usage'),
          id: 'stats',
          show: () => ConfigStore.get('user')?.options?.prefersStackedNavigation ?? false,
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
    {
      name: t('API'),
      items: [
        {
          path: `${userSettingsPathPrefix}/api/applications/`,
          title: t('Applications'),
          description: t('Add and configure OAuth2 applications'),
        },
        {
          path: `${userSettingsPathPrefix}/api/auth-tokens/`,
          title: t('User Auth Tokens'),
          description: t(
            "Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
          ),
        },
        ...HookStore.get('settings:api-navigation-config').flatMap(cb =>
          cb(incomingOrganization)
        ),
      ],
    },
  ];
}
