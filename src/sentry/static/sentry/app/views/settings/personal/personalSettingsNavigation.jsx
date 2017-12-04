import React from 'react';

import SettingsNavigation from '../components/settingsNavigation';
import navigationConfiguration from './navigationConfiguration';

const PersonalSettingsNavigation = React.createClass({
  render() {
    return (
      <SettingsNavigation navigationObjects={navigationConfiguration}/>
    );
  }
});

export default PersonalSettingsNavigation;
