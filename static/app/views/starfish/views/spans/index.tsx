import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import StarfishDatePicker from 'sentry/views/starfish/components/datePicker';
import {StarfishPageFiltersContainer} from 'sentry/views/starfish/components/starfishPageFiltersContainer';
import {StarfishProjectSelector} from 'sentry/views/starfish/components/starfishProjectSelector';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';
import {RoutingContextProvider} from 'sentry/views/starfish/utils/routingContext';

import SpansView from './spansView';

const {SPAN_MODULE} = SpanMetricsField;

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
    <RoutingContextProvider>
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
              <StarfishPageFiltersContainer>
                <StyledPageFilterBar condensed>
                  <StarfishProjectSelector />
                  <StarfishDatePicker />
                </StyledPageFilterBar>

                <SpansView moduleName={moduleName} spanCategory={spanCategory} />
              </StarfishPageFiltersContainer>
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </Layout.Page>
    </RoutingContextProvider>
  );
}

const getTitle = (moduleName: ModuleName, spanCategory?: string) => {
  if (spanCategory === 'http') {
    return t('API Calls');
  }
  if (spanCategory === 'db') {
    return ROUTE_NAMES.database;
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
  if (moduleName === 'other') {
    return t('Other Requests');
  }
  return t('Spans');
};

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;
