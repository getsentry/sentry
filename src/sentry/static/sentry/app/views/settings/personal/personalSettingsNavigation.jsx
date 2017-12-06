import React from 'react';

import SettingsNavigation from '../components/settingsNavigation';
import navigationConfiguration from './navigationConfiguration';

const PersonalSettingsNavigation = () => {
  return (
    <SettingsNavigation navigationObjects={navigationConfiguration}/>
  );
};

export default PersonalSettingsNavigation;
