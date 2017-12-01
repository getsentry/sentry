import React from 'react';

import SettingsLayout from '../settingsLayout';

class PersonalSettingsLayout extends React.Component {
  render() {

    return (
      <SettingsLayout
        {...this.props}
      >
        {this.props.children}
      </SettingsLayout>
    );
  }
}

export default PersonalSettingsLayout;
