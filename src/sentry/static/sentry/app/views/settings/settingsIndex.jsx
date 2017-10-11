import React from 'react';

import SettingsLayout from './settingsLayout';

class SettingsIndex extends React.Component {
  render() {
    return (
      <SettingsLayout {...this.props}>SELECT SOME SETTINGS OR SOMETHING</SettingsLayout>
    );
  }
}

export default SettingsIndex;
