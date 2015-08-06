import React from "react";
import AppState from "../mixins/appState";
import ConfigStore from "../stores/configStore";
import DropdownLink from "./dropdownLink";
import Gravatar from "./gravatar";
import MenuItem from "./menuItem";
import OrganizationState from "../mixins/organizationState";
import OrganizationStore from "../stores/organizationStore";
import UserInfo from "./userInfo";

var UserNav = React.createClass({
  shouldComponentUpdate(nextProps, nextState) {
    return false;
  },

  render() {
    var urlPrefix = ConfigStore.get('urlPrefix');
    var user = ConfigStore.get('user');

    if (!user) {
      // TODO
      return null;
    }

    var title = (
      <Gravatar email={user.email} className="avatar" />
    );

    return (
      <DropdownLink
          topLevelClasses={this.props.className}
          menuClasses="dropdown-menu-right"
          title={title}>
        <MenuItem href={urlPrefix + '/account/settings/'}>Account</MenuItem>
        {user.isSuperuser &&
          <MenuItem href={urlPrefix + '/manage/'}>Admin</MenuItem>
        }
        <MenuItem href={urlPrefix + '/auth/logout/'}>Sign out</MenuItem>
      </DropdownLink>
    );
  }
});

var OrganizationSelector = React.createClass({
  mixins: [
    AppState,
  ],

  shouldComponentUpdate(nextProps, nextState) {
    return (nextProps.organization || {}).id !== (this.props.organization || {}).id;
  },

  render() {
    var singleOrganization = ConfigStore.get('singleOrganization');
    var activeOrg = this.props.organization;

    if (singleOrganization || !activeOrg) {
      return null;
    }

    var urlPrefix = ConfigStore.get('urlPrefix');
    var features = ConfigStore.get('features');

    return (
      <DropdownLink
          menuClasses="dropdown-menu-right"
          topLevelClasses={(this.props.className || "") + " org-selector"}
          title={activeOrg.name}>
        {OrganizationStore.getAll().map((org) => {
          return (
            <MenuItem key={org.slug} to="organizationDetails" params={{orgId: org.slug}}
                      isActive={activeOrg.id === org.id}>
              {org.name}
            </MenuItem>
          );
        })}
        {features.has('organizations:create') &&
          <MenuItem divider={true} />
        }
        {features.has('organizations:create') &&
          <MenuItem href={urlPrefix + '/organizations/new/'}>New Organization</MenuItem>
        }
      </DropdownLink>
    );
  }
});


var Header = React.createClass({
  mixins: [OrganizationState],

  render() {
    var user = ConfigStore.get('user');
    var logo;

    if (user) {
      logo = <span className="icon-sentry-logo"/>;
    } else {
      logo = <span className="icon-sentry-logo-full"/>;
    }

    return (
      <header>
        <div className="container">
          <UserNav className="pull-right" />
          <ul className="global-nav pull-right">
            <li><a href="https://docs.getsentry.com">Docs</a></li>
          </ul>
          <a href="/" className="logo">{logo}</a>
          <OrganizationSelector organization={this.getOrganization()} className="pull-right" />
        </div>
      </header>
    );
  }
});

export default Header;

