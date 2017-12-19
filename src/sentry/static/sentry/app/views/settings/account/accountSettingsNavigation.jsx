import React from 'react';

import SettingsNavigation from '../components/settingsNavigation';
import navigationConfiguration from './navigationConfiguration';

const AccountSettingsNavigation = () => {
  return <SettingsNavigation navigationObjects={navigationConfiguration} />;
};

export default AccountSettingsNavigation;
