import {Fragment} from 'react';
import type {Query} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {HTTPThroughputWidget} from 'sentry/views/insights/http/components/widgets/httpThroughputWidget';
import {HTTPDurationWidget} from 'sentry/views/insights/http/components/widgets/httpDurationWidget';
import {HTTPResponseCodesWidget} from 'sentry/views/insights/http/components/widgets/httpResponseCodesWidget';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/http/settings';

type LocationQuery = Query & {
  domain?: string;
  subregions?: string;
  view?: string;
};

type QueryFields = {
  domain: string;
  subregions: string;
  view: string;
};

function HTTPDomainSummaryPage() {
  const query = useLocationQuery<{
    domain: typeof decodeScalar;
    subregions: typeof decodeScalar;
    view: typeof decodeScalar;
  }, QueryFields>({
    fields: {
      domain: decodeScalar,
      subregions: decodeScalar,
      view: decodeScalar,
    },
  });

  const search = MutableSearch.fromQueryObject({
    ...BASE_FILTERS,
    'http.domain': query.domain ?? undefined,
    'http.subregions': query.subregions ?? undefined,
  });

  const {
    isPending: areDomainMetricsLoading,
    data: domainMetrics,
  } = useSpanMetrics(
    {
      search,
      fields: [
        'http_response_rate(3)',
        'http_response_rate(4)',
        'http_response_rate(5)',
      ],
    },
    Referrer.DOMAIN_SUMMARY_METRICS_RIBBON
  );

  const headerProps = {
    module: ModuleName.HTTP,
  };

  return (
    <Fragment>
      {query.view === FRONTEND_LANDING_SUB_PATH && <FrontendHeader {...headerProps} />}
      {query.view === BACKEND_LANDING_SUB_PATH && <BackendHeader {...headerProps} />}
      {query.view === MOBILE_LANDING_SUB_PATH && <MobileHeader {...headerProps} />}

      <ModuleBodyUpsellHook moduleName={ModuleName.HTTP}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <HeaderContainer>
                  <ModulePageFilterBar moduleName={ModuleName.HTTP} />
                  <ReadoutRibbon>
                    <MetricReadout
                      title={t('3XX Rate')}
                      value={domainMetrics?.[0]?.['http_response_rate(3)']}
                      unit="percentage"
                      isLoading={areDomainMetricsLoading}
                    />
                    <MetricReadout
                      title={t('4XX Rate')}
                      value={domainMetrics?.[0]?.['http_response_rate(4)']}
                      unit="percentage"
                      isLoading={areDomainMetricsLoading}
                    />
                    <MetricReadout
                      title={t('5XX Rate')}
                      value={domainMetrics?.[0]?.['http_response_rate(5)']}
                      unit="percentage"
                      isLoading={areDomainMetricsLoading}
                    />
                  </ReadoutRibbon>
                </HeaderContainer>
              </ModuleLayout.Full>

              <ModuleLayout.Third>
                <HTTPThroughputWidget />
              </ModuleLayout.Third>

              <ModuleLayout.Third>
                <HTTPDurationWidget />
              </ModuleLayout.Third>

              <ModuleLayout.Third>
                <HTTPResponseCodesWidget />
              </ModuleLayout.Third>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName={ModuleName.HTTP} pageTitle={t('Domain Summary')}>
      <HTTPDomainSummaryPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
