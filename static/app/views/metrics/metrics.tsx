import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {hasCustomMetricsExtractionRules} from 'sentry/utils/metrics/features';
import {VirtualMetricsContextProvider} from 'sentry/utils/metrics/virtualMetricsContext';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricsContextProvider, useMetricsContext} from 'sentry/views/metrics/context';
import {MetricsLayout} from 'sentry/views/metrics/layout';

function WrappedPageFiltersContainer({children}: {children: React.ReactNode}) {
  const {isDefaultQuery} = useMetricsContext();
  return (
    <PageFiltersContainer disablePersistence={isDefaultQuery}>
      {children}
    </PageFiltersContainer>
  );
}

function Metrics() {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('ddm.page-view', {
      organization,
    });
    Sentry.metrics.increment('ddm.visit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SentryDocumentTitle title={t('Metrics')} orgSlug={organization.slug}>
      {hasCustomMetricsExtractionRules(organization) ? (
        <VirtualMetricsContextProvider>
          <MetricsContextProvider>
            <WrappedPageFiltersContainer>
              <MetricsLayout />
            </WrappedPageFiltersContainer>
          </MetricsContextProvider>
        </VirtualMetricsContextProvider>
      ) : (
        <MetricsContextProvider>
          <WrappedPageFiltersContainer>
            <MetricsLayout />
          </WrappedPageFiltersContainer>
        </MetricsContextProvider>
      )}
    </SentryDocumentTitle>
  );
}

export default Metrics;
