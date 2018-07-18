import React from 'react';

import SettingsNavigation from 'app/views/settings/components/settingsNavigation';
import navigationConfiguration from 'app/views/settings/account/navigationConfiguration';

const AccountSettingsNavigation = () => {
  return <SettingsNavigation navigationObjects={navigationConfiguration} />;
};

export default AccountSettingsNavigation;
