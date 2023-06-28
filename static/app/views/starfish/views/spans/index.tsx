import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import StarfishPageFilterContainer from 'sentry/views/starfish/components/pageFilterContainer';
import {ModuleName} from 'sentry/views/starfish/types';

import SpansView from './spansView';

type Query = {
  'span.category'?: string;
  'span.module'?: string;
};

export default function Spans() {
  const location = useLocation<Query>();

  const moduleName = Object.values(ModuleName).includes(
    (location.query['span.module'] ?? '') as ModuleName
  )
    ? (location.query['span.module'] as ModuleName)
    : ModuleName.ALL;

  const spanCategory = location.query['span.category'];

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Spans')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <StarfishPageFilterContainer>
              <SpansView moduleName={moduleName} spanCategory={spanCategory} />
            </StarfishPageFilterContainer>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
