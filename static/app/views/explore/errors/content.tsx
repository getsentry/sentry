import * as Layout from 'sentry/components/layouts/thirds';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

export default function ErrorsContent() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={t('Errors')} orgSlug={organization?.slug}>
      <Layout.Page>
        <ErrorsHeader />
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

function ErrorsHeader() {
  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        <Layout.Title>{t('Errors')}</Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions />
    </Layout.Header>
  );
}
