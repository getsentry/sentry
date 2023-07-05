import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {ModuleName} from 'sentry/views/starfish/types';
import SpansView from 'sentry/views/starfish/views/spans/spansView';

export default function DBModule() {
  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Database Queries')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <SpansView moduleName={ModuleName.DB} />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
