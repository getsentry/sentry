import {Outlet} from 'react-router-dom';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {SettingsLayout} from 'sentry/views/settings/components/settingsLayout';
import {SettingsCommandPaletteActions} from 'sentry/views/settings/settingsCommandPaletteActions';

export default function OrganizationSettingsLayout() {
  return (
    <AnalyticsArea name="organization">
      <SettingsLayout>
        <SettingsCommandPaletteActions />
        <Outlet />
      </SettingsLayout>
    </AnalyticsArea>
  );
}
