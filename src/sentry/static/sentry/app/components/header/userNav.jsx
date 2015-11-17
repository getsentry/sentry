import React from 'react';
import ConfigStore from '../../stores/configStore';
import DropdownLink from '../dropdownLink';
import Gravatar from '../gravatar';
import MenuItem from '../menuItem';

const UserNav = React.createClass({
  shouldComponentUpdate(nextProps, nextState) {
    return false;
  },

  render() {
    let urlPrefix = ConfigStore.get('urlPrefix');
    let user = ConfigStore.get('user');

    if (!user) {
      // TODO
      return null;
    }

    let title = (
      <Gravatar email={user.email} className="avatar" />
    );

    return (
      <DropdownLink
          topLevelClasses={this.props.className}
          menuClasses="dropdown-menu-right"
          title={title}>
        <MenuItem href={urlPrefix + '/account/settings/'}>Account</MenuItem>
        {user.isSuperuser &&
          <MenuItem to="/manage/">Admin</MenuItem>
        }
        <MenuItem href={urlPrefix + '/auth/logout/'}>Sign out</MenuItem>
      </DropdownLink>
    );
  }
});

export default UserNav;
