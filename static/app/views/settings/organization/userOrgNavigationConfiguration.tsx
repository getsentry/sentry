import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {t} from 'sentry/locale';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import type {NavigationSection} from 'sentry/views/settings/types';

const organizationSettingsPathPrefix = '/settings/:orgId';
const userSettingsPathPrefix = '/settings/account';

export function getUserOrgNavigationConfiguration(): NavigationSection[] {
  return [
    {
      id: 'settings-account',
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
      id: 'settings-organization',
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
          path: `${organizationSettingsPathPrefix}/stats/`,
          title: t('Stats & Usage'),
          description: t('View organization stats and usage'),
          id: 'stats',
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
          path: `${organizationSettingsPathPrefix}/data-forwarding/`,
          title: t('Data Forwarding'),
          description: t('Manage data forwarding across your organization'),
          id: 'data-forwarding',
          badge: () => <FeatureBadge type="beta" />,
          recordAnalytics: true,
          show: ({organization}) =>
            !!organization &&
            organization.features.includes('data-forwarding-revamp-access'),
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
            'Manage organization-level integrations, including: Slack, GitHub, Bitbucket, Jira, and Azure DevOps'
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
          description: t('Set up feature flag integrations'),
        },
        {
          path: `${organizationSettingsPathPrefix}/seer/`,
          title: t('Seer'),
          description: t(
            "Manage settings for Seer's automated analysis across your organization"
          ),
          show: ({organization}) => !!organization && !organization.hideAiFeatures,
          id: 'seer',
        },
        {
          path: `${organizationSettingsPathPrefix}/console-sdk-invites/`,
          title: t('Console SDK Invites'),
          description: t('Manage access to our private console SDK repositories'),
          show: ({organization}) =>
            !!organization && (organization.enabledConsolePlatforms?.length ?? 0) > 0,
          id: 'console-sdk-invites',
        },
      ],
    },
    {
      id: 'settings-developer',
      name: t('Developer Settings'),
      items: [
        {
          path: `${organizationSettingsPathPrefix}/auth-tokens/`,
          title: t('Organization Tokens'),
          description: t('Manage organization tokens'),
          id: 'auth-tokens',
        },
        {
          path: `${userSettingsPathPrefix}/api/auth-tokens/`,
          title: t('Personal Tokens'),
          description: t(
            "Personal tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
          ),
        },
        {
          path: `${organizationSettingsPathPrefix}/developer-settings/`,
          title: t('Custom Integrations'),
          description: t('Manage custom integrations'),
          id: 'developer-settings',
        },
        {
          path: `${userSettingsPathPrefix}/api/applications/`,
          title: t('Applications'),
          description: t('Add and configure OAuth2 applications'),
        },
      ],
    },
  ];
}
