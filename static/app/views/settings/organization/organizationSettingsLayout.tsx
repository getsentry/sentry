import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {Outlet} from 'sentry/router/reactRouter';
import {SettingsLayout} from 'sentry/views/settings/components/settingsLayout';

export default function OrganizationSettingsLayout() {
  return (
    <AnalyticsArea name="organization">
      <SettingsLayout>
        <Outlet />
      </SettingsLayout>
    </AnalyticsArea>
  );
}
