import {Outlet} from 'react-router-dom';

import {Flex} from '@sentry/scraps/layout';

import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {BreadcrumbProvider} from 'sentry/views/settings/components/settingsBreadcrumb/context';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';
import SettingsNavigation from 'sentry/views/settings/components/settingsNavigation';

// TODO: Move this to /views/nav/secondary/sections/admin/adminSecondaryNav.tsx when new navigation is GA'd
export function AdminNavigation() {
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
      primaryNavGroup={PrimaryNavGroup.ADMIN}
    />
  );
}

export default function AdminLayout() {
  return (
    <SentryDocumentTitle noSuffix title={t('Sentry Admin')}>
      <Flex flexGrow={1}>
        <BreadcrumbProvider>
          <SettingsLayout>
            <Outlet />
          </SettingsLayout>
        </BreadcrumbProvider>
      </Flex>
    </SentryDocumentTitle>
  );
}
