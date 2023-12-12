import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useOrganization from 'sentry/utils/useOrganization';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';
import AppStartup from 'sentry/views/starfish/views/appStartup';

export default function InitializationModule() {
  const organization = useOrganization();

  return (
    <Feature features="starfish-view">
      <SentryDocumentTitle title={ROUTE_NAMES['app-startup']} orgSlug={organization.slug}>
        <Layout.Page>
          <PageErrorProvider>
            <Layout.Header>
              <Layout.HeaderContent>
                <Layout.Title>{ROUTE_NAMES['app-startup']}</Layout.Title>
              </Layout.HeaderContent>
            </Layout.Header>

            <Layout.Body>
              <Layout.Main fullWidth>
                <PageErrorAlert />
                <PageFiltersContainer>
                  <Container>
                    <PageFilterBar condensed>
                      <ProjectPageFilter />
                      <EnvironmentPageFilter />
                      <DatePageFilter />
                    </PageFilterBar>
                    <ReleaseComparisonSelector />
                  </Container>
                  <ErrorBoundary mini>
                    <AppStartup chartHeight={240} />
                  </ErrorBoundary>
                </PageFiltersContainer>
              </Layout.Main>
            </Layout.Body>
          </PageErrorProvider>
        </Layout.Page>
      </SentryDocumentTitle>
    </Feature>
  );
}

const Container = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;
