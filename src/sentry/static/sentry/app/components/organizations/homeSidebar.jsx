import React from 'react';

import ListLink from '../listLink';
import OrganizationState from '../../mixins/organizationState';
import ConfigStore from '../../stores/configStore';
import HookStore from '../../stores/hookStore';
import {t} from '../../locale';

const HomeSidebar = React.createClass({
  mixins: [OrganizationState],

  render() {
    let access = this.getAccess();
    let features = this.getFeatures();
    let org = this.getOrganization();
    let urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;

    // Allow injection via getsentry et all
    let children = [];
    HookStore.get('organization:sidebar').forEach((cb) => {
      children.push(cb(org));
    });

    let orgId = org.slug;
    return (
      <div>
        <h6 className="nav-header">{t('Organization')}</h6>
        <ul className="nav nav-stacked">
          <ListLink to={`/${orgId}/`}>{t('Projects')}</ListLink>
          {access.has('org:read') &&
            <ListLink to={`/organizations/${orgId}/stats/`}>{t('Stats')}</ListLink>
          }
        </ul>
        {access.has('org:read') &&
          <div>
            <h6 className="nav-header">{t('Manage')}</h6>
            <ul className="nav nav-stacked">
              {access.has('org:read') &&
                <li>
                  <a href={urlPrefix + '/members/'}>
                    {t('Members')}&nbsp;
                    {access.has('org:write') && org.pendingAccessRequests > 0 &&
                      <span className="badge" style={{marginLeft: 5}}>{org.pendingAccessRequests}</span>
                    }
                  </a>
                </li>
              }
              {features.has('sso') && access.has('org:write') &&
                <li><a href={urlPrefix + '/auth/'}>{t('Auth')}</a></li>
              }
              {access.has('org:write') &&
                <li><a href={urlPrefix + '/api-keys/'}>{t('API Keys')}</a></li>
              }
              {access.has('org:write') &&
                <li><a href={urlPrefix + '/audit-log/'}>{t('Audit Log')}</a></li>
              }
              <ListLink to={`/organizations/${orgId}/rate-limits/`}>Rate Limits</ListLink>
              {access.has('org:write') &&
                <li><a href={urlPrefix + '/settings/'}>{t('Settings')}</a></li>
              }
            </ul>
          </div>
        }
        {children}
      </div>
    );
  }
});

export default HomeSidebar;
