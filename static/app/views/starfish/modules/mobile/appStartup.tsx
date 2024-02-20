import {useEffect} from 'react';
import {browserHistory} from 'react-router';
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
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';
import AppStartup from 'sentry/views/starfish/views/appStartup';
import {
  COLD_START_TYPE,
  StartTypeSelector,
} from 'sentry/views/starfish/views/appStartup/screenSummary/startTypeSelector';

export default function InitializationModule() {
  const organization = useOrganization();
  const location = useLocation();

  const appStartType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? '';
  useEffect(() => {
    // Default the start type to cold start if not present
    if (!appStartType) {
      browserHistory.replace({
        ...location,
        query: {
          ...location.query,
          [SpanMetricsField.APP_START_TYPE]: COLD_START_TYPE,
        },
      });
    }
  }, [location, appStartType]);

  return (
    <Feature features="starfish-mobile-appstart" organization={organization}>
      <SentryDocumentTitle title={ROUTE_NAMES['app-startup']} orgSlug={organization.slug}>
        <Layout.Page>
          <PageAlertProvider>
            <Layout.Header>
              <Layout.HeaderContent>
                <Layout.Title>{ROUTE_NAMES['app-startup']}</Layout.Title>
              </Layout.HeaderContent>
            </Layout.Header>

            <Layout.Body>
              <Layout.Main fullWidth>
                <PageAlert />
                <PageFiltersContainer>
                  <Container>
                    <PageFilterBar condensed>
                      <ProjectPageFilter />
                      <EnvironmentPageFilter />
                      <DatePageFilter />
                    </PageFilterBar>
                    <ReleaseComparisonSelector />
                    <StartTypeSelector />
                  </Container>
                </PageFiltersContainer>
                <ErrorBoundary mini>
                  <AppStartup chartHeight={240} />
                </ErrorBoundary>
              </Layout.Main>
            </Layout.Body>
          </PageAlertProvider>
        </Layout.Page>
      </SentryDocumentTitle>
    </Feature>
  );
}

const Container = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  flex-wrap: wrap;
`;
