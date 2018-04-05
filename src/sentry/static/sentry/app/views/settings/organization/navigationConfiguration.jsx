import {t} from '../../../locale';

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
      },
      {
        path: `${pathPrefix}/projects/`,
        title: t('Projects'),
      },
      {
        path: `${pathPrefix}/teams/`,
        title: t('Teams'),
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
      },
      {
        path: `${pathPrefix}/auth/`,
        title: t('Auth'),
        show: ({access, features}) => features.has('sso') && access.has('org:admin'),
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
      },
      {
        path: `${pathPrefix}/rate-limits/`,
        title: t('Rate Limits'),
        show: ({access}) => access.has('org:write'),
      },
      {
        path: `${pathPrefix}/repos/`,
        title: t('Repositories'),
        show: ({access}) => access.has('org:write'),
      },
    ],
  },
];

export default organizationNavigation;
