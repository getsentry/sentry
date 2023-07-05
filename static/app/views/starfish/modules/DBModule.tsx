import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import StarfishDatePicker from 'sentry/views/starfish/components/datePicker';
import {StarfishProjectSelector} from 'sentry/views/starfish/components/starfishProjectSelector';
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
            <FilterOptionsContainer condensed>
              <StarfishProjectSelector />
              <StarfishDatePicker />
            </FilterOptionsContainer>
            <SpansView moduleName={ModuleName.DB} />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

const FilterOptionsContainer = styled(PageFilterBar)`
  margin: 0 ${space(2)};
  margin-bottom: ${space(2)};
`;
