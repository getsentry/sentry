import React from 'react';

import SettingsLayout from '../settingsLayout';
import SettingsPageHeader from '../components/settingsPageHeader';

class PersonalSettingsLayout extends React.Component {
  render() {

    return (
      <SettingsLayout {...this.props}>
        {this.props.children}
        <div>
          <SettingsPageHeader label="Notifications" />
        </div>

      </SettingsLayout>
    );
  }
}

export default PersonalSettingsLayout;
