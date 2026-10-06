import {Outlet} from 'react-router-dom';

import {Flex} from '@sentry/scraps/layout';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {SettingsLayout} from 'sentry/views/settings/components/settingsLayout';

export default function AdminLayout() {
  return (
    <SentryDocumentTitle noSuffix title={t('Sentry Admin')}>
      <Flex flexGrow={1}>
        <SettingsLayout>
          <Outlet />
        </SettingsLayout>
      </Flex>
    </SentryDocumentTitle>
  );
}
