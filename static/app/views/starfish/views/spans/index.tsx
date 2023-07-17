import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName, SpanMetricsFields} from 'sentry/views/starfish/types';

import SpansView from './spansView';

const {SPAN_MODULE} = SpanMetricsFields;

type Query = {
  'span.category'?: string;
  'span.module'?: string;
};

export default function Spans() {
  const location = useLocation<Query>();

  const moduleName = Object.values(ModuleName).includes(
    (location.query[SPAN_MODULE] ?? '') as ModuleName
  )
    ? (location.query[SPAN_MODULE] as ModuleName)
    : ModuleName.ALL;

  const spanCategory = location.query['span.category'];

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{getTitle(moduleName, spanCategory)}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <PageFiltersContainer>
              <SpansView moduleName={moduleName} spanCategory={spanCategory} />
            </PageFiltersContainer>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

const getTitle = (moduleName: ModuleName, spanCategory?: string) => {
  if (spanCategory === 'http') {
    return t('API Calls');
  }
  if (spanCategory === 'db') {
    return t('Database Queries');
  }
  if (spanCategory === 'cache') {
    return t('Cache Queries');
  }
  if (spanCategory === 'serialize') {
    return t('Serializers');
  }
  if (spanCategory === 'middleware') {
    return t('Middleware Components/Calls');
  }
  if (spanCategory === 'app') {
    return t('Application Tasks');
  }
  if (moduleName === 'Other') {
    return t('Other Requests');
  }
  return t('Spans');
};
