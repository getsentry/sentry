import React from 'react';

import AccountSettingsNavigation from 'app/views/settings/account/accountSettingsNavigation';
import SettingsLayout from 'app/views/settings/components/settingsLayout';

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
