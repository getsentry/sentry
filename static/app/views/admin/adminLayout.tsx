import {Outlet} from 'react-router-dom';

import {Flex} from '@sentry/scraps/layout';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {SettingsBreadcrumbsProvider} from 'sentry/views/settings/components/settingsBreadcrumb/settingsBreadcrumbsProvider';
import {SettingsLayout} from 'sentry/views/settings/components/settingsLayout';

export default function AdminLayout() {
  return (
    <SentryDocumentTitle noSuffix title={t('Sentry Admin')}>
      <Flex flexGrow={1}>
        <SettingsBreadcrumbsProvider>
          <SettingsLayout>
            <Outlet />
          </SettingsLayout>
        </SettingsBreadcrumbsProvider>
      </Flex>
    </SentryDocumentTitle>
  );
}
