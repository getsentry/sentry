import React from 'react';

import SettingsPageHeader from '../components/settingsPageHeader';
import InternalLinkButton from '../../../components/internalLinkButton';

const AccountEmails = () => {
  return (
    <div>
      <SettingsPageHeader title="Emails" />
      <InternalLinkButton to="/settings/account/notifications" icon="icon-stack">
        Wanna change how many emails you get? Use the notifications panel.
      </InternalLinkButton>
    </div>
  );
};

export default AccountEmails;
