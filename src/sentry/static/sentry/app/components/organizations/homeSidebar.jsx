import React from 'react';
import OrganizationState from '../../mixins/organizationState';
import HookStore from '../../stores/hookStore';
import {t} from '../../locale';
import {NavHeader, NavStacked, NavItem, NavDivider} from '../../components/navigation';

const HomeSidebar = React.createClass({
  contextTypes: {
    location: React.PropTypes.object
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
      hooks: hooks
    };
  },

  render() {
    let access = this.getAccess();
    let features = this.getFeatures();
    let org = this.getOrganization();
    let orgId = org.slug;
    let hasPendingAccessRequests =
      access.has('org:write') && org.pendingAccessRequests > 0;

    return (
      <div>
        <NavHeader>{t('Organization')}</NavHeader>
        <NavStacked>
          <NavItem
            to={`/${orgId}/`}
            isActive={() => {
              // return true if path matches /organizations/slug-name/teams/ OR /organizations/slug-name/all-teams/
              return /^\/[^\/]+\/$/.test(this.context.location.pathname);
            }}>
            {t('Dashboard')}
          </NavItem>
          <NavItem
            to={`/organizations/${orgId}/teams/`}
            isActive={() => {
              // return true if path matches /organizations/slug-name/teams/ OR /organizations/slug-name/all-teams/
              return /^\/organizations\/[^\/]+\/(teams|all-teams)\/$/.test(
                this.context.location.pathname
              );
            }}>
            {t('Projects & Teams')}
          </NavItem>
          {access.has('org:read') &&
            <NavItem to={`/organizations/${orgId}/stats/`}>{t('Stats')}</NavItem>}
        </NavStacked>

        <NavDivider />

        <NavHeader>{t('Issues')}</NavHeader>
        <NavStacked>
          <NavItem to={`/organizations/${orgId}/issues/assigned/`}>
            {t('Assigned to Me')}
          </NavItem>
          <NavItem to={`/organizations/${orgId}/issues/bookmarks/`}>
            {t('Bookmarks')}
          </NavItem>
          <NavItem to={`/organizations/${orgId}/issues/history/`}>
            {t('History')}
          </NavItem>
        </NavStacked>

        {access.has('org:read') &&
          <div>
            <NavDivider />
            <NavHeader>{t('Manage')}</NavHeader>
            <NavStacked>
              {access.has('org:read') &&
                <NavItem href={`/organizations/${orgId}/members/`}>
                  {t('Members')}&nbsp;
                  {hasPendingAccessRequests &&
                    <span className="badge" style={{marginLeft: 5}}>
                      {org.pendingAccessRequests}
                    </span>}
                </NavItem>}
              {features.has('sso') &&
                access.has('org:admin') &&
                <NavItem href={`/organizations/${orgId}/auth/`}>{t('Auth')}</NavItem>}
              {access.has('org:admin') &&
                features.has('api-keys') &&
                <NavItem href={`/organizations/${orgId}/api-keys/`}>
                  {t('API Keys')}
                </NavItem>}
              {access.has('org:write') &&
                <NavItem to={`/organizations/${orgId}/audit-log/`}>
                  {t('Audit Log')}
                </NavItem>}
              {access.has('org:write') &&
                <NavItem to={`/organizations/${orgId}/rate-limits/`}>
                  {t('Rate Limits')}
                </NavItem>}
              {access.has('org:write') &&
                <NavItem to={`/organizations/${orgId}/repos/`}>
                  {t('Repositories')}
                </NavItem>}
              {access.has('org:write') &&
                <NavItem to={`/organizations/${orgId}/settings/`}>
                  {t('Settings')}
                </NavItem>}
            </NavStacked>
          </div>}
        {this.state.hooks}
      </div>
    );
  }
});

export default HomeSidebar;
