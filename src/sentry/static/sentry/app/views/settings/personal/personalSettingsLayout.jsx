import React from 'react';

import SettingsLayout from '../settingsLayout';
import SettingsPageHeader from '../components/settingsPageHeader';
import PersonalSettingsForm from './personalSettingsForm';

class PersonalSettingsLayout extends React.Component {
  render() {

    return (
      <SettingsLayout {...this.props}>
        {this.props.children}
        <div>
          <SettingsPageHeader label="Notifications" />
          <PersonalSettingsForm {...this.props}/>
        </div>

      </SettingsLayout>
    );
  }
}

export default PersonalSettingsLayout;
