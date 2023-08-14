import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useOrganization from 'sentry/utils/useOrganization';
import StarfishDatePicker from 'sentry/views/starfish/components/datePicker';
import {StarfishPageFiltersContainer} from 'sentry/views/starfish/components/starfishPageFiltersContainer';
import {StarfishProjectSelector} from 'sentry/views/starfish/components/starfishProjectSelector';
import {ModuleName} from 'sentry/views/starfish/types';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';
import SpansView from 'sentry/views/starfish/views/spans/spansView';

export default function DBModule() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={ROUTE_NAMES.database} orgSlug={organization.slug}>
      <Layout.Page>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>{ROUTE_NAMES.database}</Layout.Title>
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

                <SpansView moduleName={ModuleName.DB} />
              </StarfishPageFiltersContainer>
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;
