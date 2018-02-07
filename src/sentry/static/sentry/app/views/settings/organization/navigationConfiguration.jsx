import React from 'react';

import {t} from '../../../locale';
import withLatestContext from '../../../utils/withLatestContext';
import SentryTypes from '../../../proptypes';

const pathPrefix = '/settings/organization/:orgId';

const Badge = withLatestContext(
  class BadgeComponent extends React.Component {
    static propTypes = {
      organization: SentryTypes.Organization,
    };

    render() {
      let {organization} = this.props;
      if (!organization) return null;
      let {pendingAccessRequests} = organization;
      if (pendingAccessRequests <= 0) return null;
      // cast to string
      return `${pendingAccessRequests}`;
    }
  }
);

const organizationNavigation = [
  {
    name: 'Organization',
    items: [
      {
        path: `${pathPrefix}/settings/`,
        title: t('General Settings'),
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
        path: `${pathPrefix}/stats/`,
        title: t('Stats'),
        show: ({access}) => access.has('org:read'),
      },
      {
        path: `${pathPrefix}/members/`,
        title: t('Members'),
        // eslint-disable-next-line no-shadow
        badge: ({access}) => {
          if (!access.has('org:write')) return null;
          return <Badge />;
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
      {
        path: `${pathPrefix}/integrations/`,
        title: t('Integrations'),
        show: ({access, features}) =>
          features.has('integrations-v3') && access.has('org:integrations'),
      },
    ],
  },
];

export default organizationNavigation;
