import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

export default function SessionsView() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('Sessions')} orgSlug={organization.slug}>
      <Stack flex={1}>
        <TopBar.Slot name="title">{t('Sessions')}</TopBar.Slot>

        <Layout.Body>
          <Layout.Main width="full">
            <Text>{t('Nothing here yet.')}</Text>
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
