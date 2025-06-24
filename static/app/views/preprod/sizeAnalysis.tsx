import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';

function SizeAnalysis() {
  return (
    <SentryDocumentTitle title={t('Size analysis')}>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <Layout.Title>
            {t('Size analysis')} <FeatureBadge type="new" />
          </Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>Main content (coming soon)</Layout.Main>
      </Layout.Body>
    </SentryDocumentTitle>
  );
}

export default SizeAnalysis;
