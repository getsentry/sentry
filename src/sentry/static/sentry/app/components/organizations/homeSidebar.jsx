import React from "react";

import ListLink from "../listLink";
import OrganizationState from "../../mixins/organizationState";

import ConfigStore from "../../stores/configStore";
import HookStore from "../../stores/hookStore";

var HomeSidebar = React.createClass({
  mixins: [OrganizationState],

  render() {
    var access = this.getAccess();
    var features = this.getFeatures();
    var org = this.getOrganization();
    var urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;

    // Allow injection via getsentry et all
    var children = [];
    HookStore.get('organization:sidebar').forEach((cb) => {
      children.push(cb(org));
    });

    let orgId = org.slug;
    return (
      <div>
        <h6 className="nav-header">General</h6>
        <ul className="nav nav-stacked">
          <ListLink to={`/${orgId}/`}>Projects</ListLink>
          {access.has('org:read') &&
            <ListLink to={`/organizations/${orgId}/stats/`}>Stats</ListLink>
          }
        </ul>
        {access.has('org:read') &&
          <div>
            <h6 className="nav-header">Manage</h6>
            <ul className="nav nav-stacked">
              {access.has('org:read') &&
                <li>
                  <a href={urlPrefix + '/members/'}>
                    Members&nbsp;
                    {access.has('org:write') && org.pendingAccessRequests > 0 &&
                      <span className="badge">{org.pendingAccessRequests}</span>
                    }
                  </a>
                </li>
              }
              {features.has('sso') && access.has('org:write') &&
                <li><a href={urlPrefix + '/auth/'}>Auth</a></li>
              }
              {access.has('org:write') &&
                <li><a href={urlPrefix + '/api-keys/'}>API Keys</a></li>
              }
              {access.has('org:write') &&
                <li><a href={urlPrefix + '/audit-log/'}>Audit Log</a></li>
              }
              {access.has('org:write') &&
                <li><a href={urlPrefix + '/settings/'}>Settings</a></li>
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
