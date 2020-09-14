import {t} from 'app/locale';
import {NavigationSection} from 'app/views/settings/types';

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
        path: `${pathPrefix}/security-and-privacy/`,
        title: t('Security & Privacy'),
        description: t(
          'Configuration related to dealing with sensitive data and other security settings. (Data Scrubbing, Data Privacy, Data Scrubbing)'
        ),
        id: 'security-and-privacy',
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
        path: `${pathPrefix}/performance/`,
        title: t('Performance'),
        show: ({features}) => features!.has('performance-view'),
        description: t('Manage performance settings'),
        id: 'performance',
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
        path: `${pathPrefix}/relays/`,
        title: t('Relays'),
        show: ({access, features}) => features!.has('relay') && access!.has('org:write'),
        description: t('Manage relays connected to the organization'),
        id: 'relays',
        badge: () => 'new',
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
        path: `${pathPrefix}/developer-settings/`,
        title: t('Developer Settings'),
        description: t('Manage developer applications'),
        id: 'developer-settings',
      },
    ],
  },
];

export default organizationNavigation;
