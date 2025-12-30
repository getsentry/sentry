import {Outlet} from 'react-router-dom';

import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

export default function OrganizationSettingsLayout() {
  return (
    <SettingsLayout>
      <Outlet />
    </SettingsLayout>
  );
}
