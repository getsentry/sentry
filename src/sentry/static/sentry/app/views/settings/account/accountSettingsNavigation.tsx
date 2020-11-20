import React from 'react';

import navigationConfiguration from 'app/views/settings/account/navigationConfiguration';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';

const AccountSettingsNavigation = () => (
  <SettingsNavigation navigationObjects={navigationConfiguration} />
);

export default AccountSettingsNavigation;
