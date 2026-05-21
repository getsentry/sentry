import {FeatureBadge} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import {showNewSeer} from 'sentry/utils/seer/showNewSeer';
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
          keywords: [t('user settings'), t('account settings')],
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
          keywords: [t('weekly report')],
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
          keywords: [t('slug'), t('org slug'), t('organization slug')],
          index: true,
          description: t('Configure general settings for an organization'),
          id: 'general',
        },
        {
          path: `${organizationSettingsPathPrefix}/stats/`,
          title: t('Stats & Usage'),
          keywords: [t('data retention'), t('event retention'), t('quota')],
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
          keywords: [
            t('data scrubbing'),
            t('privacy'),
            t('pii'),
            t('attachments'),
            t('advanced data scrubbing'),
          ],
          description: t(
            'Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing)'
          ),
          id: 'security-and-privacy',
        },
        {
          path: `${organizationSettingsPathPrefix}/auth/`,
          title: t('Auth'),
          keywords: [t('sso'), t('single sign-on'), t('authentication'), t('login')],
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
          recordAnalytics: true,
        },
        {
          path: `${organizationSettingsPathPrefix}/relay/`,
          title: t('Relay'),
          description: t('Manage relays connected to the organization'),
          id: 'relay',
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
      id: 'settings-seer',
      name: t('Seer'),
      items: [
        {
          path: `${organizationSettingsPathPrefix}/seer/`,
          title: t('Issue Scans & Fixes'),
          description: t("Manage Seer's automated issue analysis across your projects"),
          id: 'seer-autofix-legacy',
          index: true,
          show: ({organization}) => !!organization && !showNewSeer(organization),
        },
        {
          path: `${organizationSettingsPathPrefix}/seer/projects/`,
          title: t('Autofix'),
          description: t("Manage Seer's automated issue analysis across your projects"),
          id: 'seer-autofix-new',
          show: ({organization}) => !!organization && showNewSeer(organization),
        },
        {
          path: `${organizationSettingsPathPrefix}/seer/repos/`,
          title: t('Code Review'),
          description: t("Manage Seer's automated code review settings"),
          id: 'seer-code-review',
          show: ({organization}) =>
            !!organization &&
            (organization.features.includes('seat-based-seer-enabled') ||
              organization.features.includes('code-review-beta')),
        },
        {
          path: `${organizationSettingsPathPrefix}/seer/advanced/`,
          title: t('Advanced Settings'),
          description: t('Configure advanced Seer settings'),
          id: 'seer-advanced',
          show: ({organization}) => !!organization && showNewSeer(organization),
        },
      ],
    },
    {
      id: 'settings-integrations',
      name: t('Integrations'),
      items: [
        {
          path: `${organizationSettingsPathPrefix}/mcp-cli/`,
          title: t('MCP & CLI'),
          description: t('Connect to Sentry via MCP server or the Sentry CLI'),
          id: 'mcp-cli',
        },
        {
          path: `${organizationSettingsPathPrefix}/integrations/`,
          title: t('Integrations'),
          keywords: [
            t('slack'),
            t('github'),
            t('gitlab'),
            t('bitbucket'),
            t('jira'),
            t('azure devops'),
            t('vercel'),
            t('pagerduty'),
            t('opsgenie'),
            t('discord'),
            t('microsoft teams'),
            t('msteams'),
            t('aws lambda'),
            t('perforce'),
            t('heroku'),
            t('splunk'),
            t('trello'),
            t('asana'),
            t('twilio'),
            t('victorops'),
            t('segment'),
            t('code mappings'),
          ],
          description: t(
            'Manage organization-level integrations, including: Slack, GitHub, Bitbucket, Jira, and Azure DevOps'
          ),
          id: 'integrations',
          recordAnalytics: true,
        },
        {
          path: `${organizationSettingsPathPrefix}/repos/`,
          title: t('Repositories'),
          description: t('Manage repositories connected to the organization'),
          id: 'repos',
          recordAnalytics: true,
        },
        {
          path: `${organizationSettingsPathPrefix}/developer-settings/`,
          title: t('Custom Integrations'),
          keywords: [
            t('integration'),
            t('internal integration'),
            t('developer settings'),
            t('webhooks'),
          ],
          description: t('Manage custom integrations'),
          id: 'developer-settings',
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
          keywords: [
            t('auth'),
            t('auth token'),
            t('auth tokens'),
            t('api token'),
            t('token'),
            t('credentials'),
          ],
          description: t('Manage organization tokens'),
          id: 'auth-tokens',
        },
        {
          path: `${userSettingsPathPrefix}/api/auth-tokens/`,
          title: t('Personal Tokens'),
          keywords: [
            t('auth'),
            t('auth token'),
            t('auth tokens'),
            t('api token'),
            t('token'),
            t('credentials'),
          ],
          description: t(
            "Personal tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
          ),
        },
        {
          path: `${userSettingsPathPrefix}/api/applications/`,
          title: t('OAuth Applications'),
          description: t('Add and configure OAuth2 applications'),
        },
      ],
    },
  ];
}
