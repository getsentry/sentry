import React from 'react';

import SettingsPageHeader from '../components/settingsPageHeader';
import CrossSectionLinkButton from '../components/crossSectionLinkButton';

const AccountEmails = () => {
  return (
    <div>
      <SettingsPageHeader title="Emails" />
      <CrossSectionLinkButton to="/settings/account/notifications" icon="icon-stack">
        Wanna change how many emails you get? Use the notifications panel.
      </CrossSectionLinkButton>
    </div>
  );
};

export default AccountEmails;
