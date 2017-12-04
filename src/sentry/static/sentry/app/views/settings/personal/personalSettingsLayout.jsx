import React from 'react';

import SettingsLayout from '../settingsLayout';
import PersonalSettingsNavigation from './personalSettingsNavigation';

class PersonalSettingsLayout extends React.Component {
  render() {

    return (
      <SettingsLayout
        {...this.props}
        renderNavigation={() => <PersonalSettingsNavigation {...this.props} />}
      >
        {this.props.children}
      </SettingsLayout>
    );
  }
}

export default PersonalSettingsLayout;
