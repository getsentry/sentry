import {t} from 'app/locale';

const pathPrefix = '/settings/:orgId';

const organizationNavigation = [
  {
    name: 'Organization',
    items: [
      {
        path: `${pathPrefix}/`,
        title: t('General Settings'),
        index: true,
        show: ({access}) => access.has('org:write'),
        description: t('Configure general settings for an organization'),
      },
      {
        path: `${pathPrefix}/projects/`,
        title: t('Projects'),
        description: t("View and manage an organization's projects"),
      },
      {
        path: `${pathPrefix}/teams/`,
        title: t('Teams'),
        description: t("Manage an organization's teams"),
      },
      {
        path: `${pathPrefix}/members/`,
        title: t('Members'),
        // eslint-disable-next-line no-shadow
        badge: ({organization, access, features}) => {
          if (!access.has('org:write')) return null;
          if (organization.pendingAccessRequests <= 0) return null;

          return `${organization.pendingAccessRequests}`;
        },
        show: ({access}) => access.has('member:read'),
        description: t('Manage user membership for an organization'),
      },
      {
        path: `${pathPrefix}/auth/`,
        title: t('Auth'),
        show: ({access, features}) => features.has('sso') && access.has('org:admin'),
        description: t('Configure single sign-on'),
      },
      {
        path: `${pathPrefix}/api-keys/`,
        title: t('API Keys'),
        show: ({access, features}) => features.has('api-keys') && access.has('org:admin'),
      },
      {
        path: `${pathPrefix}/audit-log/`,
        title: t('Audit Log'),
        show: ({access}) => access.has('org:write'),
        description: t('View the audit log for an organization'),
      },
      {
        path: `${pathPrefix}/rate-limits/`,
        title: t('Rate Limits'),
        show: ({access}) => access.has('org:write'),
        description: t('Configure rate limits for all projects in the organization'),
      },
      {
        path: `${pathPrefix}/repos/`,
        title: t('Repositories'),
        show: ({access}) => access.has('org:write'),
        description: t('Manage repositories connected to the organization'),
      },
    ],
  },
];

export default organizationNavigation;
