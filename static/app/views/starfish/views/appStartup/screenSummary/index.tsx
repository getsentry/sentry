import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';
import omit from 'lodash/omit';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

import AppStartWidgets from './widgets';

type Query = {
  primaryRelease: string;
  project: string;
  secondaryRelease: string;
  transaction: string;
};

function ScreenSummary() {
  const organization = useOrganization();
  const location = useLocation<Query>();

  const {transaction: transactionName} = location.query;

  const startupModule: LocationDescriptor = {
    pathname: `/organizations/${organization.slug}/starfish/appStartup/`,
    query: {
      ...omit(location.query, [
        QueryParameterNames.SPANS_SORT,
        'transaction',
        SpanMetricsField.SPAN_OP,
      ]),
    },
  };

  const crumbs: Crumb[] = [
    {
      to: startupModule,
      label: t('App Startup'),
      preservePageFilters: true,
    },
    {
      to: '',
      label: t('Screen Summary'),
    },
  ];

  return (
    <SentryDocumentTitle title={transactionName} orgSlug={organization.slug}>
      <Layout.Page>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs crumbs={crumbs} />
              <Layout.Title>{transactionName}</Layout.Title>
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
                  <AppStartWidgets
                    additionalFilters={[`transaction:${transactionName}`]}
                  />
                </ErrorBoundary>
              </PageFiltersContainer>
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default ScreenSummary;

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
