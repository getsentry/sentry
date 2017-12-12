import PropTypes from 'prop-types';
import React from 'react';

import ListLink from '../listLink';
import OrganizationState from '../../mixins/organizationState';
import HookStore from '../../stores/hookStore';
import {t} from '../../locale';

let RouterOrBrowserLink = ({isRouter, path, ...props}) =>
  isRouter ? (
    <ListLink to={path} {...props} />
  ) : (
    <li>
      <a href={path} {...props} />
    </li>
  );

RouterOrBrowserLink.propTypes = {
  isRouter: PropTypes.bool,
  path: PropTypes.string.isRequired,
};

const OrgSettingsMenu = ({access, org, features}) => {
  if (!access.has('org:read')) return null;

  let hasNewSettings = features.has('new-settings');
  let pathPrefix = `${hasNewSettings
    ? '/settings/organization'
    : '/organizations'}/${org.slug}`;

  return (
    <div>
      <h6 className="nav-header with-divider">{t('Manage')}</h6>
      <ul className="nav nav-stacked">
        {access.has('org:read') && (
          <RouterOrBrowserLink isRouter={hasNewSettings} path={`${pathPrefix}/members/`}>
            {t('Members')}&nbsp;
            {access.has('org:write') &&
              org.pendingAccessRequests > 0 && (
                <span className="badge" style={{marginLeft: 5}}>
                  {org.pendingAccessRequests}
                </span>
              )}
          </RouterOrBrowserLink>
        )}
        {features.has('sso') &&
          access.has('org:admin') && (
            <RouterOrBrowserLink
              isRouter={false}
              path={`/organizations/${org.slug}/auth/`}
            >
              {t('Auth')}
            </RouterOrBrowserLink>
          )}

        {access.has('org:admin') &&
          features.has('api-keys') && (
            <ListLink to={`${pathPrefix}/api-keys/`}>{t('API Keys')}</ListLink>
          )}

        {access.has('org:write') && (
          <ListLink to={`${pathPrefix}/audit-log/`}>{t('Audit Log')}</ListLink>
        )}
        {access.has('org:write') && (
          <ListLink to={`${pathPrefix}/rate-limits/`}>{t('Rate Limits')}</ListLink>
        )}
        {features.has('integrations-v3') &&
          access.has('org:integrations') && (
            <ListLink to={`${pathPrefix}/integrations/`}>{t('Integrations')}</ListLink>
          )}
        {access.has('org:write') && (
          <ListLink to={`${pathPrefix}/repos/`}>{t('Repositories')}</ListLink>
        )}
        {access.has('org:write') && (
          <ListLink to={`${pathPrefix}/settings/`}>{t('Settings')}</ListLink>
        )}
      </ul>
    </div>
  );
};

OrgSettingsMenu.propTypes = {
  access: PropTypes.object,
  features: PropTypes.object,
  org: PropTypes.object,
};

const HomeSidebar = React.createClass({
  contextTypes: {
    location: PropTypes.object,
  },

  mixins: [OrganizationState],

  getInitialState() {
    // Allow injection via getsentry et all
    let org = this.getOrganization();
    let hooks = [];
    HookStore.get('organization:sidebar').forEach(cb => {
      hooks.push(cb(org));
    });

    return {
      hooks,
    };
  },

  render() {
    let access = this.getAccess();
    let features = this.getFeatures();
    let org = this.getOrganization();

    let hasNewSettings = features.has('new-settings');
    let pathPrefix = `${hasNewSettings
      ? '/settings/organization'
      : '/organizations'}/${org.slug}`;
    let orgId = org.slug;

    return (
      <div>
        <h6 className="nav-header">{t('Organization')}</h6>
        <ul className="nav nav-stacked">
          <ListLink
            to={`/${orgId}/`}
            isActive={() => {
              // return true if path matches /organizations/slug-name/teams/ OR /organizations/slug-name/all-teams/
              return /^\/[^\/]+\/$/.test(this.context.location.pathname);
            }}
          >
            {t('Dashboard')}
          </ListLink>
          <ListLink
            to={`${pathPrefix}/teams/`}
            isActive={() => {
              // return true if path matches /organizations/slug-name/teams/ OR /organizations/slug-name/all-teams/
              return /^\/organizations\/[^\/]+\/(teams|all-teams)\/$/.test(
                this.context.location.pathname
              );
            }}
          >
            {t('Projects & Teams')}
          </ListLink>
          {access.has('org:read') && (
            <ListLink to={`/organizations/${orgId}/stats/`}>{t('Stats')}</ListLink>
          )}
        </ul>
        <div>
          <h6 className="nav-header with-divider">{t('Issues')}</h6>
          <ul className="nav nav-stacked">
            <ListLink to={`/organizations/${orgId}/issues/assigned/`}>
              {t('Assigned to Me')}
            </ListLink>
            <ListLink to={`/organizations/${orgId}/issues/bookmarks/`}>
              {t('Bookmarks')}
            </ListLink>
            <ListLink to={`/organizations/${orgId}/issues/history/`}>
              {t('History')}
            </ListLink>
          </ul>
        </div>

        <OrgSettingsMenu access={access} features={features} org={org} />

        {this.state.hooks}
      </div>
    );
  },
});

export default HomeSidebar;
