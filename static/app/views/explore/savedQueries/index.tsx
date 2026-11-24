import {Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

import {SavedQueriesLandingContent} from './savedQueriesLandingContent';

export default function SavedQueriesView() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('Saved Queries')} orgSlug={organization?.slug}>
      <Stack flex={1}>
        <TopBar.Slot
          name="breadcrumbs"
          title={{type: 'page-title', label: t('Saved Queries')}}
        />

        <Layout.Body>
          <Layout.Main width="full">
            <SavedQueriesLandingContent />
          </Layout.Main>
        </Layout.Body>
      </Stack>
    </SentryDocumentTitle>
  );
}
