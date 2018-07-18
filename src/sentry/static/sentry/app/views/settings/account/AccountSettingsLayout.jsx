import React from 'react';

import AccountSettingsNavigation from 'app/views/settings/account/accountSettingsNavigation';
import SettingsLayout from 'app/views/settings/components/settingsLayout';

class AccountSettingsLayout extends React.Component {
  render() {
    return (
      <div className="app">
        <SettingsLayout
          {...this.props}
          renderNavigation={() => <AccountSettingsNavigation {...this.props} />}
        >
          {this.props.children}
        </SettingsLayout>
      </div>
    );
  }
}

export default AccountSettingsLayout;
