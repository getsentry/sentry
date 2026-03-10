import {OrganizationAvatar, ProjectAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {FeatureBadge} from '@sentry/scraps/badge';

import {IconCode, IconProject, IconSliders, IconTerminal} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import type {NavigationSection} from 'sentry/views/settings/types';

const organizationSettingsPathPrefix = '/settings/:orgId';
const projectSettingsPathPrefix = '/settings/:orgId/projects/:projectId';
const userSettingsPathPrefix = '/settings/account';

export function getUserOrgNavigationConfiguration(): NavigationSection[] {
  return [
    {
      id: 'settings-organization',
      name: t('Organization Settings'),
      renderIcon: ({organization}) =>
        organization ? (
          <OrganizationAvatar organization={organization} size={16} />
        ) : null,
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
          badge: () => <FeatureBadge type="new" />,
          recordAnalytics: true,
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
      id: 'settings-project',
      name: t('Project Settings'),
      renderIcon: ({project}) =>
        project ? (
          <ProjectAvatar project={project} size={16} />
        ) : (
          <IconProject size="sm" />
        ),
      items: [
        {
          path: `${projectSettingsPathPrefix}/`,
          index: true,
          title: t('General Settings'),
          description: t('Configure general settings for a project'),
        },
        {
          path: `${projectSettingsPathPrefix}/teams/`,
          title: t('Project Teams'),
          description: t('Manage team access for a project'),
        },
        {
          path: `${projectSettingsPathPrefix}/alerts/`,
          title: t('Alert Settings'),
          description: t('Project alert settings'),
        },
        {
          path: `${projectSettingsPathPrefix}/tags/`,
          title: t('Tags & Context'),
          description: t("View and manage a project's tags and context"),
        },
        {
          path: `${projectSettingsPathPrefix}/environments/`,
          title: t('Environments'),
          description: t('Manage environments in a project'),
        },
        {
          path: `${projectSettingsPathPrefix}/ownership/`,
          title: t('Ownership Rules'),
          description: t('Manage ownership rules for a project'),
        },
        {
          path: `${projectSettingsPathPrefix}/seer/`,
          title: t('Seer'),
          show: ({organization}) => !organization?.hideAiFeatures,
        },
        {
          path: `${projectSettingsPathPrefix}/user-feedback/`,
          title: t('User Feedback'),
          show: () => !ConfigStore.get('isSelfHostedErrorsOnly'),
        },
        {
          path: `${projectSettingsPathPrefix}/toolbar/`,
          title: t('Dev Toolbar'),
          show: ({organization}) =>
            !!organization?.features?.includes('sentry-toolbar-ui'),
          badge: () => 'beta',
        },
        {
          path: `${projectSettingsPathPrefix}/plugins/`,
          title: t('Legacy Integrations'),
          description: t('View, enable, and disable all integrations for a project'),
          id: 'legacy_integrations',
          recordAnalytics: true,
        },
      ],
      subsections: [
        {
          id: 'settings-processing',
          name: t('Processing'),
          icon: IconSliders,
          items: [
            {
              path: `${projectSettingsPathPrefix}/filters/`,
              title: t('Inbound Filters'),
              description: t(
                "Configure a project's inbound filters (e.g. browsers, messages)"
              ),
            },
            {
              path: `${projectSettingsPathPrefix}/security-and-privacy/`,
              title: t('Security & Privacy'),
              description: t(
                'Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing) for a project'
              ),
            },
            {
              path: `${projectSettingsPathPrefix}/issue-grouping/`,
              title: t('Issue Grouping'),
            },
            {
              path: `${projectSettingsPathPrefix}/debug-symbols/`,
              title: t('Debug Files'),
            },
            {
              path: `${projectSettingsPathPrefix}/proguard/`,
              title: t('ProGuard'),
            },
            {
              path: `${projectSettingsPathPrefix}/source-maps/`,
              title: t('Source Maps'),
            },
            {
              path: `${projectSettingsPathPrefix}/performance/`,
              title: t('Performance'),
              show: ({organization}) =>
                !!organization?.features?.includes('performance-view') &&
                !ConfigStore.get('isSelfHostedErrorsOnly'),
            },
            {
              path: `${projectSettingsPathPrefix}/replays/`,
              title: t('Replays'),
              show: ({organization}) =>
                !!organization?.features?.includes('session-replay-ui') &&
                !ConfigStore.get('isSelfHostedErrorsOnly'),
            },
            {
              path: `${projectSettingsPathPrefix}/playstation/`,
              title: t('PlayStation'),
              show: ({organization}) =>
                !!(organization && hasTempestAccess(organization)) &&
                !ConfigStore.get('isSelfHosted'),
            },
            {
              path: `${projectSettingsPathPrefix}/mobile-builds/`,
              title: t('Mobile Builds'),
              show: ({organization}) =>
                !!organization?.features?.includes('preprod-frontend-routes'),
              badge: () => 'new',
              description: t('Size analysis and build distribution configuration.'),
            },
          ],
        },
        {
          id: 'settings-sdk',
          name: t('SDK Setup'),
          icon: IconTerminal,
          items: [
            {
              path: `${projectSettingsPathPrefix}/keys/`,
              title: t('Client Keys (DSN)'),
              description: t("View and manage the project's client keys (DSN)"),
            },
            {
              path: `${projectSettingsPathPrefix}/loader-script/`,
              title: t('Loader Script'),
              description: t("View and manage the project's Loader Script"),
            },
            {
              path: `${projectSettingsPathPrefix}/release-tracking/`,
              title: t('Releases'),
            },
            {
              path: `${projectSettingsPathPrefix}/security-headers/`,
              title: t('Security Headers'),
            },
          ],
        },
      ],
    },
    {
      id: 'settings-developer',
      name: t('Developer Settings'),
      icon: IconCode,
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
    {
      id: 'settings-account',
      name: t('User Settings'),
      renderIcon: () => {
        const user = ConfigStore.get('user');
        return user ? <UserAvatar user={user} size={16} /> : null;
      },
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
  ];
}
