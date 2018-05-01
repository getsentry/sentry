import PropTypes from 'prop-types';
import React from 'react';
import ConfigStore from 'app/stores/configStore';
import DropdownLink from 'app/components/dropdownLink';
import Avatar from 'app/components/avatar';
import MenuItem from 'app/components/menuItem';
import {t} from 'app/locale';

class UserNav extends React.Component {
  static contextTypes = {
    location: PropTypes.object,
    organization: PropTypes.object,
  };

  shouldComponentUpdate(nextProps, nextState) {
    return false;
  }

  render() {
    let user = ConfigStore.get('user');
    let {organization} = this.context;

    if (!user) {
      // TODO
      return null;
    }

    let title = <Avatar size={32} user={user} className="avatar" />;

    // "to" attribute => in-app router
    // "href" attribute => Django-powered views
    let to = url => (this.context.location ? {to: url} : {href: url});
    // #NEW-SETTINGS
    let hasNewSettings =
      organization && organization.features.indexOf('new-settings') > -1;

    return (
      <DropdownLink topLevelClasses={this.props.className} title={title} caret={false}>
        {hasNewSettings ? (
          <MenuItem {...to('/settings/account/')}>{t('Account')}</MenuItem>
        ) : (
          <MenuItem href="/account/settings/">{t('Account')}</MenuItem>
        )}
        {hasNewSettings ? (
          <MenuItem {...to('/settings/account/api/')}>{t('API')}</MenuItem>
        ) : (
          <MenuItem {...to('/api/')}>{t('API')}</MenuItem>
        )}
        {user.isSuperuser && <MenuItem {...to('/manage/')}>{t('Admin')}</MenuItem>}
        <MenuItem href="/auth/logout/">{t('Sign out')}</MenuItem>
      </DropdownLink>
    );
  }
}

export default UserNav;
