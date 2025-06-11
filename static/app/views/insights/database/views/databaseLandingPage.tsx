import React from 'react';

import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import DatabaseLandingDurationChartWidget from 'sentry/views/insights/common/components/widgets/databaseLandingDurationChartWidget';
import DatabaseLandingThroughputChartWidget from 'sentry/views/insights/common/components/widgets/databaseLandingThroughputChartWidget';
import {useDatabaseLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingChartFilter';
import {useDatabaseLandingDurationQuery} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingDurationQuery';
import {useDatabaseLandingThroughputQuery} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingThroughputQuery';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {DatabasePageFilters} from 'sentry/views/insights/database/components/databasePageFilters';
import {NoDataMessage} from 'sentry/views/insights/database/components/noDataMessage';
import {
  isAValidSort,
  QueriesTable,
} from 'sentry/views/insights/database/components/tables/queriesTable';
import {useSystemSelectorOptions} from 'sentry/views/insights/database/components/useSystemSelectorOptions';
import {
  BASE_FILTERS,
  DEFAULT_DURATION_AGGREGATE,
} from 'sentry/views/insights/database/settings';
import {BackendHeader} from 'sentry/views/insights/pages/backend/backendPageHeader';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

export function DatabaseLandingPage() {
  const organization = useOrganization();
  const moduleName = ModuleName.DB;
  const location = useLocation();
  const onboardingProject = useOnboardingProject();
  const hasModuleData = useHasFirstSpan(moduleName);
  const {search, enabled} = useDatabaseLandingChartFilter();

  const selectedAggregate = DEFAULT_DURATION_AGGREGATE;
  const spanDescription =
    decodeScalar(location.query?.['sentry.normalized_description'], '') ||
    decodeScalar(location.query?.['span.description'], '');
  const spanAction = decodeScalar(location.query?.['span.action']);
  const spanDomain = decodeScalar(location.query?.['span.domain']);

  const sortField = decodeScalar(location.query?.[QueryParameterNames.SPANS_SORT]);

  // If there is no query parameter for the system, retrieve the current value from the hook instead
  const systemQueryParam = decodeScalar(location.query?.[SpanMetricsField.SPAN_SYSTEM]);
  const {selectedSystem} = useSystemSelectorOptions();

  const system = systemQueryParam ?? selectedSystem;

  let sort = decodeSorts(sortField).find(isAValidSort);
  if (!sort) {
    sort = DEFAULT_SORT;
  }

  const navigate = useNavigate();

  const handleSearch = (newQuery: string) => {
    trackAnalytics('insight.general.search', {
      organization,
      query: newQuery,
      source: ModuleName.DB,
    });
    navigate({
      ...location,
      query: {
        ...location.query,
        'sentry.normalized_description': newQuery === '' ? undefined : newQuery,
        [QueryParameterNames.SPANS_CURSOR]: undefined,
      },
    });
  };

  const tableFilters = {
    ...BASE_FILTERS,
    'span.action': spanAction,
    'span.domain': spanDomain,
    'sentry.normalized_description': spanDescription ? `*${spanDescription}*` : undefined,
    'span.system': system,
  };

  const cursor = decodeScalar(location.query?.[QueryParameterNames.SPANS_CURSOR]);

  const queryListResponse = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject(tableFilters),
      fields: [
        'project.id',
        'span.group',
        'sentry.normalized_description',
        'span.action',
        'epm()',
        'avg(span.self_time)',
        'sum(span.self_time)',
      ],
      sorts: [sort],
      limit: LIMIT,
      cursor,
    },
    'api.starfish.use-span-list'
  );

  const {isPending: isThroughputDataLoading, data: throughputData} =
    useDatabaseLandingThroughputQuery({search, enabled});

  const {isPending: isDurationDataLoading, data: durationData} =
    useDatabaseLandingDurationQuery({search, enabled});

  const isCriticalDataLoading =
    isThroughputDataLoading || isDurationDataLoading || queryListResponse.isPending;

  const isAnyCriticalDataAvailable =
    (queryListResponse.data ?? []).length > 0 ||
    durationData[`${selectedAggregate}(span.self_time)`].data?.some(
      ({value}) => value > 0
    ) ||
    throughputData['epm()'].data?.some(({value}) => value > 0);

  return (
    <React.Fragment>
      <BackendHeader module={ModuleName.DB} />
      <ModuleBodyUpsellHook moduleName={ModuleName.DB}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              {hasModuleData && !onboardingProject && !isCriticalDataLoading && (
                <NoDataMessage
                  Wrapper={AlertBanner}
                  isDataAvailable={isAnyCriticalDataAvailable}
                />
              )}

              <ModuleLayout.Full>
                <DatabasePageFilters
                  system={system}
                  databaseCommand={spanAction}
                  table={spanDomain}
                />
              </ModuleLayout.Full>
              <ModulesOnboarding moduleName={ModuleName.DB}>
                <ModuleLayout.Half>
                  <DatabaseLandingThroughputChartWidget />
                </ModuleLayout.Half>

                <ModuleLayout.Half>
                  <DatabaseLandingDurationChartWidget />
                </ModuleLayout.Half>

                <ModuleLayout.Full>
                  <SearchBar
                    query={spanDescription}
                    placeholder={t('Search for more queries')}
                    onSearch={handleSearch}
                  />
                </ModuleLayout.Full>

                <ModuleLayout.Full>
                  <QueriesTable
                    response={queryListResponse}
                    sort={sort}
                    system={system}
                  />
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

function AlertBanner(props: any) {
  return (
    <ModuleLayout.Full>
      <Alert.Container>
        <Alert {...props} type="info" showIcon />
      </Alert.Container>
    </ModuleLayout.Full>
  );
}

const LIMIT = 25;

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="db" analyticEventName="insight.page_loads.db">
      <DatabaseLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
