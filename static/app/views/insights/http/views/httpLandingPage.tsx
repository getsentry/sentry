import React from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useHttpLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useHttpLandingChartFilter';
import HttpDurationChartWidget from 'sentry/views/insights/common/components/widgets/httpDurationChartWidget';
import HttpResponseCodesChartWidget from 'sentry/views/insights/common/components/widgets/httpResponseCodesChartWidget';
import HttpThroughputChartWidget from 'sentry/views/insights/common/components/widgets/httpThroughputChartWidget';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {
  DomainsTable,
  isAValidSort,
} from 'sentry/views/insights/http/components/tables/domainsTable';
import {Referrer} from 'sentry/views/insights/http/referrers';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {BACKEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/backend/settings';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {FRONTEND_LANDING_SUB_PATH} from 'sentry/views/insights/pages/frontend/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {MOBILE_LANDING_SUB_PATH} from 'sentry/views/insights/pages/mobile/settings';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName} from 'sentry/views/insights/types';

export function HTTPLandingPage() {
  const organization = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const {view} = useDomainViewFilters();

  const query = useLocationQuery({
    fields: {
      'span.domain': decodeScalar,
      [QueryParameterNames.DOMAINS_SORT]: decodeScalar,
    },
  });

  const sort =
    decodeSorts(query?.[QueryParameterNames.DOMAINS_SORT]).find(isAValidSort) ??
    DEFAULT_SORT;
  const cursor = decodeScalar(location.query?.[QueryParameterNames.DOMAINS_CURSOR]);

  const chartFilters = useHttpLandingChartFilter();

  const tableFilters = {
    ...chartFilters,
    'span.domain': query['span.domain'] ? `*${query['span.domain']}*` : undefined,
  };

  const handleSearch = (newDomain: string) => {
    trackAnalytics('insight.general.search', {
      organization,
      query: newDomain,
      source: ModuleName.HTTP,
    });
    navigate({
      ...location,
      query: {
        ...location.query,
        'span.domain': newDomain === '' ? undefined : newDomain,
        [QueryParameterNames.SPANS_CURSOR]: undefined,
      },
    });
  };

  const domainsListResponse = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(tableFilters),
      fields: [
        'project',
        'project.id',
        'span.domain',
        'epm()',
        'http_response_rate(3)',
        'http_response_rate(4)',
        'http_response_rate(5)',
        'avg(span.self_time)',
        'sum(span.self_time)',
      ],
      sorts: [sort],
      limit: DOMAIN_TABLE_ROW_COUNT,
      cursor,
    },
    Referrer.LANDING_DOMAINS_LIST
  );

  const headerProps = {
    module: ModuleName.HTTP,
  };

  return (
    <React.Fragment>
      {view === FRONTEND_LANDING_SUB_PATH && <FrontendHeader {...headerProps} />}
      {view === BACKEND_LANDING_SUB_PATH && <BackendHeader {...headerProps} />}
      {view === MOBILE_LANDING_SUB_PATH && <MobileHeader {...headerProps} />}

      <ModuleBodyUpsellHook moduleName={ModuleName.HTTP}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ToolRibbon>
                  <ModulePageFilterBar
                    moduleName={ModuleName.HTTP}
                    extraFilters={<SubregionSelector />}
                  />
                </ToolRibbon>
              </ModuleLayout.Full>

              <ModulesOnboarding moduleName={ModuleName.HTTP}>
                <ModuleLayout.Third>
                  <HttpThroughputChartWidget />
                </ModuleLayout.Third>

                <ModuleLayout.Third>
                  <HttpDurationChartWidget />
                </ModuleLayout.Third>

                <ModuleLayout.Third>
                  <HttpResponseCodesChartWidget />
                </ModuleLayout.Third>

                <ModuleLayout.Full>
                  <SearchBar
                    query={query['span.domain']}
                    placeholder={t('Search for more domains')}
                    onSearch={handleSearch}
                  />
                </ModuleLayout.Full>

                <ModuleLayout.Full>
                  <DomainsTable response={domainsListResponse} sort={sort} />
                </ModuleLayout.Full>
              </ModulesOnboarding>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </React.Fragment>
  );
}

const DEFAULT_SORT = {
  field: 'sum(span.self_time)' as const,
  kind: 'desc' as const,
};

const DOMAIN_TABLE_ROW_COUNT = 10;

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="http" analyticEventName="insight.page_loads.http">
      <HTTPLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
