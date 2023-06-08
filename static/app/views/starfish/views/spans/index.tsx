import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName} from 'sentry/views/starfish/types';

import SpansView from './spansView';

type Query = {
  'span.module'?: string;
};

export default function Spans() {
  const location = useLocation<Query>();

  const moduleName = Object.values(ModuleName).includes(
    (location.query['span.module'] ?? '') as ModuleName
  )
    ? (location.query['span.module'] as ModuleName)
    : ModuleName.ALL;

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
            <PageFiltersContainer>
              <SpansView moduleName={moduleName} />
            </PageFiltersContainer>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
