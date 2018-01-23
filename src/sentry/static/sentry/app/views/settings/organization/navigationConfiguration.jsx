import {t} from '../../../locale';

const pathPrefix = '/settings/organization/:orgId';

const organizationNavigation = [
  {
    name: 'Organization',
    items: [
      {
        path: `${pathPrefix}/settings/`,
        title: 'General Settings',
        show: ({access}) => access.has('org:write'),
      },
      {
        path: `${pathPrefix}/teams/`,
        title: t('Teams'),
      },
      {
        path: `${pathPrefix}/projects/`,
        title: t('Projects'),
      },
      {
        path: `${pathPrefix}/stats/`,
        title: t('Stats'),
        show: ({access}) => access.has('org:read'),
      },
      {
        path: `${pathPrefix}/members/`,
        title: 'Members',
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
        title: 'Auth',
        show: ({access, features}) => features.has('sso') && access.has('org:admin'),
      },
      {
        path: `${pathPrefix}/api-keys/`,
        title: 'API Keys',
        show: ({access, features}) => features.has('api-keys') && access.has('org:admin'),
      },
      {
        path: `${pathPrefix}/audit-log/`,
        title: 'Audit Log',
        show: ({access}) => access.has('org:write'),
      },
      {
        path: `${pathPrefix}/rate-limits/`,
        title: 'Rate Limits',
        show: ({access}) => access.has('org:write'),
      },
      {
        path: `${pathPrefix}/repos/`,
        title: 'Repositories',
        show: ({access}) => access.has('org:write'),
      },
      {
        path: `${pathPrefix}/integrations/`,
        title: 'Integrations',
        show: ({access, features}) =>
          features.has('integrations-v3') && access.has('org:integrations'),
      },
    ],
  },
];

export default organizationNavigation;
