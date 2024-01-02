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
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {StarfishPageFiltersContainer} from 'sentry/views/starfish/components/starfishPageFiltersContainer';
import {StarfishProjectSelector} from 'sentry/views/starfish/components/starfishProjectSelector';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';
import {ScreensView, YAxis} from 'sentry/views/starfish/views/screens';

export default function ResponsivenessModule() {
  const organization = useOrganization();

  return (
    <SentryDocumentTitle title={ROUTE_NAMES.responsiveness} orgSlug={organization.slug}>
      <Layout.Page>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>{ROUTE_NAMES.responsiveness}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>

          <Layout.Body>
            <Layout.Main fullWidth>
              <PageErrorAlert />
              <StarfishPageFiltersContainer>
                <SearchContainerWithFilterAndMetrics>
                  <PageFilterBar condensed>
                    <StarfishProjectSelector />
                    <StarfishDatePicker />
                  </PageFilterBar>
                  <ReleaseComparisonSelector />
                </SearchContainerWithFilterAndMetrics>
                <ScreensView yAxes={[YAxis.SLOW_FRAME_RATE, YAxis.FROZEN_FRAME_RATE]} />
              </StarfishPageFiltersContainer>
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const SearchContainerWithFilterAndMetrics = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;
