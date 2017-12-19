import React from 'react';

import SettingsLayout from '../settingsLayout';
import AccountSettingsNavigation from './accountSettingsNavigation';

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
