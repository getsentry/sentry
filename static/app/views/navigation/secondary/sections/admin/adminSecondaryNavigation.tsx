import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';

export function AdminSecondaryNavigation() {
  return (
    <SettingsNavigation
      stickyTop="0"
      navigationObjects={[
        {
          id: 'admin-system-status',
          name: 'System Status',
          items: [
            {path: '/manage/status/environment/', title: 'Environment'},
            {path: '/manage/status/packages/', title: 'Packages'},
            {path: '/manage/status/mail/', title: 'Mail'},
            {path: '/manage/status/warnings/', title: 'Warnings'},
            {path: '/manage/settings/', title: 'Settings'},
          ],
        },
        {
          id: 'admin-manage',
          name: 'Manage',
          items: [
            {path: '/manage/organizations/', title: 'Organizations'},
            {path: '/manage/projects/', title: 'Projects'},
            {path: '/manage/users/', title: 'Users'},
          ],
        },
      ]}
    />
  );
}
