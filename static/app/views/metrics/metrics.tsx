import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';
import {DDMContextProvider, useMetricsContext} from 'sentry/views/metrics/context';
import {MetricsLayout} from 'sentry/views/metrics/layout';
import {useOptInModal} from 'sentry/views/metrics/optInModal';

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
  useOptInModal();

  useEffect(() => {
    trackAnalytics('ddm.page-view', {
      organization,
    });
    Sentry.metrics.increment('ddm.visit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasCustomMetrics(organization)) {
    return (
      <Layout.Page withPadding>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Layout.Page>
    );
  }

  return (
    <SentryDocumentTitle title={t('Metrics')} orgSlug={organization.slug}>
      <DDMContextProvider>
        <WrappedPageFiltersContainer>
          <MetricsLayout />
        </WrappedPageFiltersContainer>
      </DDMContextProvider>
    </SentryDocumentTitle>
  );
}

export default Metrics;
