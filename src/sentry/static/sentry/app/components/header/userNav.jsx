import React from "react";
import ConfigStore from "../../stores/configStore";
import DropdownLink from "../dropdownLink";
import Gravatar from "../gravatar";
import MenuItem from "../menuItem";

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
          <MenuItem to="admin">Admin</MenuItem>
        }
        <MenuItem href={urlPrefix + '/auth/logout/'}>Sign out</MenuItem>
      </DropdownLink>
    );
  }
});

export default UserNav;
