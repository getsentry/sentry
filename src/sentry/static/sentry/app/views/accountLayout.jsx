import React from 'react';

import DropdownLink from '../components/dropdownLink';
import ListLink from '../components/listLink';
import MenuItem from '../components/menuItem';
import NarrowLayout from '../components/narrowLayout';
import {t} from '../locale';

const AccountLayout = React.createClass({
  render() {
    let header = (
      <div>
        <div className="pull-right">
          <a href="/account/logout/">{t('Sign out')}</a>
        </div>
        <a href="/">
          <span className="icon-sentry-logo"></span>
          <span className="back-to">{t('Back to organization')}</span>
        </a>
      </div>
    );

    return (
      <NarrowLayout header={header}>
        <h3>{t('My Settings')}</h3>
        <DropdownLink topLevelClasses="anchor-right pull-right" title={t('More')}>
          <MenuItem to="/account/authorizations/">{t('Authorized Applications')}</MenuItem>
          <MenuItem href="/account/identities/">{t('Identities')}</MenuItem>
          <MenuItem href="/account/remove/">{t('Close Account')}</MenuItem>
        </DropdownLink>
        <ul className="nav nav-tabs border-bottom">
          <li><a href="/account/settings/">{t('Account')}</a></li>
          <li><a href="/account/avatar/">{t('Avatar')}</a></li>
          <li><a href="/account/appearance/">{t('Appearance')}</a></li>
          <li><a href="/account/notifications/">{t('Notifications')}</a></li>
          <li><a href="/account/emails/">{t('Emails')}</a></li>
          <li><a href="/account/security/">{t('Security')}</a></li>
          <li><a href="/account/subscriptions/">{t('Subscriptions')}</a></li>
        </ul>
        {this.props.children}
      </NarrowLayout>
    );
  }
});

export default AccountLayout;

