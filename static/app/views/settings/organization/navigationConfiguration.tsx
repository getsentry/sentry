import FeatureBadge from 'sentry/components/featureBadge';
import {t} from 'sentry/locale';
import {NavigationSection} from 'sentry/views/settings/types';

const pathPrefix = '/settings/:orgId';

const organizationNavigation: NavigationSection[] = [
  {
    name: t('Organization'),
    items: [
      {
        path: `${pathPrefix}/`,
        title: t('General Settings'),
        index: true,
        description: t('Configure general settings for an organization'),
        id: 'general',
      },
      {
        path: `${pathPrefix}/projects/`,
        title: t('Projects'),
        description: t("View and manage an organization's projects"),
        id: 'projects',
      },
      {
        path: `${pathPrefix}/teams/`,
        title: t('Teams'),
        description: t("Manage an organization's teams"),
        id: 'teams',
      },
      {
        path: `${pathPrefix}/members/`,
        title: t('Members'),
        show: ({access}) => access!.has('member:read'),
        description: t('Manage user membership for an organization'),
        id: 'members',
      },
      {
        path: `${pathPrefix}/security-and-privacy/`,
        title: t('Security & Privacy'),
        description: t(
          'Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing)'
        ),
        id: 'security-and-privacy',
      },
      {
        path: `${pathPrefix}/auth/`,
        title: t('Auth'),
        description: t('Configure single sign-on'),
        id: 'sso',
      },
      {
        path: `${pathPrefix}/api-keys/`,
        title: t('API Keys'),
        show: ({access, features}) =>
          features!.has('api-keys') && access!.has('org:admin'),
        id: 'api-keys',
      },
      {
        path: `${pathPrefix}/audit-log/`,
        title: t('Audit Log'),
        show: ({access}) => access!.has('org:write'),
        description: t('View the audit log for an organization'),
        id: 'audit-log',
      },
      {
        path: `${pathPrefix}/rate-limits/`,
        title: t('Rate Limits'),
        show: ({access, features}) =>
          features!.has('legacy-rate-limits') && access!.has('org:write'),
        description: t('Configure rate limits for all projects in the organization'),
        id: 'rate-limits',
      },
      {
        path: `${pathPrefix}/relay/`,
        title: t('Relay'),
        description: t('Manage relays connected to the organization'),
        id: 'relay',
      },
      {
        path: `${pathPrefix}/repos/`,
        title: t('Repositories'),
        description: t('Manage repositories connected to the organization'),
        id: 'repos',
      },
      {
        path: `${pathPrefix}/integrations/`,
        title: t('Integrations'),
        description: t(
          'Manage organization-level integrations, including: Slack, Github, Bitbucket, Jira, and Azure DevOps'
        ),
        id: 'integrations',
        recordAnalytics: true,
      },
      {
        path: `${pathPrefix}/early-features/`,
        title: t('Early Features'),
        description: t('Manage early access features'),
        badge: () => <FeatureBadge type="new" />,
        show: ({isSelfHosted}) => isSelfHosted || false,
        id: 'early-features',
        recordAnalytics: true,
      },
    ],
  },
  {
    name: t('Developer Settings'),
    items: [
      {
        path: `${pathPrefix}/auth-tokens/`,
        title: t('Auth Tokens'),
        description: t('Manage organization auth tokens'),
        id: 'auth-tokens',
      },
      {
        path: `${pathPrefix}/developer-settings/`,
        title: t('Custom Integrations'),
        description: t('Manage custom integrations'),
        id: 'developer-settings',
      },
    ],
  },
];

export default organizationNavigation;
