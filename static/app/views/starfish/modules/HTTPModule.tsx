import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import StarfishPageFilterContainer from 'sentry/views/starfish/components/pageFilterContainer';
import {ModuleName} from 'sentry/views/starfish/types';
import SpansView from 'sentry/views/starfish/views/spans/spansView';

export default function HTTPModule() {
  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('API Calls')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <StarfishPageFilterContainer>
              <SpansView moduleName={ModuleName.HTTP} />
            </StarfishPageFilterContainer>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
