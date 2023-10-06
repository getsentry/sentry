import styled from '@emotion/styled';
import {LocationDescriptor} from 'history';
import omit from 'lodash/omit';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getTransactionName} from 'sentry/views/performance/utils';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {StarfishPageFiltersContainer} from 'sentry/views/starfish/components/starfishPageFiltersContainer';
import {useRoutingContext} from 'sentry/views/starfish/utils/routingContext';
import {
  getPrimaryRelease,
  getSecondaryRelease,
} from 'sentry/views/starfish/views/mobileServiceView/utils';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {ScreensView, YAxis} from 'sentry/views/starfish/views/screens';
import {ScreenLoadSpansTable} from 'sentry/views/starfish/views/screens/screenLoadSpans/table';

function ScreenLoadSpans() {
  const location = useLocation();
  const organization = useOrganization();
  const transactionName = getTransactionName(location);
  const primaryRelease = getPrimaryRelease(location);
  const secondaryRelease = getSecondaryRelease(location);
  const routingContext = useRoutingContext();

  const screenLoadModule: LocationDescriptor = {
    pathname: `${routingContext.baseURL}/pageload/`,
    query: {
      ...omit(location.query, QueryParameterNames.SPANS_SORT),
    },
  };

  const crumbs: Crumb[] = [
    {
      to: screenLoadModule,
      label: t('Module View'),
      preservePageFilters: true,
    },
    {
      to: '',
      label: t('Screen Load'),
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
              <StarfishPageFiltersContainer>
                <Container>
                  <PageFilterBar condensed>
                    <DatePageFilter alignDropdown="left" />
                  </PageFilterBar>
                  <ReleaseComparisonSelector />
                </Container>
              </StarfishPageFiltersContainer>
              <ScreensView
                yAxes={[YAxis.THROUGHPUT, YAxis.TTID, YAxis.TTFD]}
                additionalFilters={[`transaction:${transactionName}`]}
                chartHeight={120}
              />
              <ScreenLoadSpansTable
                transaction={transactionName}
                primaryRelease={primaryRelease}
                secondaryRelease={secondaryRelease}
              />
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default ScreenLoadSpans;

const Container = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;
