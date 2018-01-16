import React from 'react';

import SettingsPageHeader from '../components/settingsPageHeader';
import InternalLinkButton from '../../../components/internalLinkButton';
import {t} from '../../../locale';

const AccountEmails = () => {
  return (
    <div>
      <SettingsPageHeader title="Emails" />
      <InternalLinkButton to="/settings/account/notifications" icon="icon-stack">
        {t('Wanna change how many emails you get? Use the notifications panel.')}
      </InternalLinkButton>
    </div>
  );
};

export default AccountEmails;
