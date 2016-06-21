import React from 'react';
import ConfigStore from '../../stores/configStore';
import DropdownLink from '../dropdownLink';
import Avatar from '../avatar';
import MenuItem from '../menuItem';
import {t} from '../../locale';

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
      <Avatar user={user} className="avatar" />
    );

    return (
      <DropdownLink
          topLevelClasses={this.props.className}
          menuClasses="dropdown-menu-right"
          title={title}>
        <MenuItem href={urlPrefix + '/account/settings/'}>{t('Account')}</MenuItem>
        <MenuItem to="/api/">{t('API')}</MenuItem>
        {user.isSuperuser &&
          <MenuItem to="/manage/">{t('Admin')}</MenuItem>
        }
        <MenuItem href={urlPrefix + '/auth/logout/'}>{t('Sign out')}</MenuItem>
      </DropdownLink>
    );
  }
});

export default UserNav;
