import React from 'react';

import SettingsPageHeader from '../components/settingsPageHeader';
import AlertLink from '../../../components/alertLink';
import {t} from '../../../locale';

const AccountEmails = () => {
  return (
    <div>
      <SettingsPageHeader title="Emails" />
      <AlertLink to="/settings/account/notifications" icon="icon-stack">
        {t('Wanna change how many emails you get? Use the notifications panel.')}
      </AlertLink>
    </div>
  );
};

export default AccountEmails;
