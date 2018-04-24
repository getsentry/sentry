import React from 'react';

import AccountSettingsNavigation from './accountSettingsNavigation';
import SettingsLayout from '../components/settingsLayout';

class AccountSettingsLayout extends React.Component {
  render() {
    return (
      <SettingsLayout
        {...this.props}
        renderNavigation={() => <AccountSettingsNavigation {...this.props} />}
      >
        {this.props.children}
      </SettingsLayout>
    );
  }
}

export default AccountSettingsLayout;
