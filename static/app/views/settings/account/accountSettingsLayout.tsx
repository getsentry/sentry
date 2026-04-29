import {Outlet} from 'react-router-dom';

import {SettingsLayout} from 'sentry/views/settings/components/settingsLayout';
import {SettingsCommandPaletteActions} from 'sentry/views/settings/settingsCommandPaletteActions';

export default function AccountSettingsLayout() {
  return (
    <SettingsLayout>
      <SettingsCommandPaletteActions />
      <Outlet />
    </SettingsLayout>
  );
}
