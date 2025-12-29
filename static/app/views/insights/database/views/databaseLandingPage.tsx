import React from 'react';

import type {AlertProps} from 'sentry/components/core/alert';
import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import DatabaseLandingDurationChartWidget from 'sentry/views/insights/common/components/widgets/databaseLandingDurationChartWidget';
import DatabaseLandingThroughputChartWidget from 'sentry/views/insights/common/components/widgets/databaseLandingThroughputChartWidget';
import {useDatabaseLandingChartFilter} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingChartFilter';
import {useDatabaseLandingDurationQuery} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingDurationQuery';
import {useDatabaseLandingThroughputQuery} from 'sentry/views/insights/common/components/widgets/hooks/useDatabaseLandingThroughputQuery';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
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
import {BASE_FILTERS} from 'sentry/views/insights/database/settings';
import useHasDashboardsPlatformizedQueries from 'sentry/views/insights/database/utils/useHasDashboardsPlatformaizedQueries';
import {PlatformizedQueriesOverview} from 'sentry/views/insights/database/views/platformizedOverview';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';

export function DatabaseLandingPage() {
  const organization = useOrganization();
  const moduleName = ModuleName.DB;
  const location = useLocation();
  const onboardingProject = useOnboardingProject();
  const hasModuleData = useHasFirstSpan(moduleName);
  const {search, enabled} = useDatabaseLandingChartFilter();

  const spanDescription =
    decodeScalar(location.query?.['sentry.normalized_description'], '') ||
    decodeScalar(location.query?.['span.description'], '');
  const spanAction = decodeScalar(location.query?.['span.action']);
  const spanDomain = decodeScalar(location.query?.['span.domain']);

  const sortField = decodeScalar(location.query?.[QueryParameterNames.SPANS_SORT]);

  // If there is no query parameter for the system, retrieve the current value from the hook instead
  const systemQueryParam = decodeScalar(location.query?.[SpanFields.SPAN_SYSTEM]);
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

  const queryListResponse = useSpans(
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
    'api.insights.use-span-list'
  );

  const {isPending: isThroughputDataLoading, data: throughputData} =
    useDatabaseLandingThroughputQuery({search, enabled});

  const {isPending: isDurationDataLoading, data: durationData} =
    useDatabaseLandingDurationQuery({search, enabled});

  const isCriticalDataLoading =
    isThroughputDataLoading || isDurationDataLoading || queryListResponse.isPending;

  const isAnyCriticalDataAvailable =
    (queryListResponse.data ?? []).length > 0 ||
    [...(durationData?.timeSeries ?? []), ...(throughputData?.timeSeries ?? [])]
      .flatMap(timeSeries => timeSeries.values)
      .some(({value}) => value && value > 0);

  return (
    <React.Fragment>
      <ModuleFeature moduleName={ModuleName.DB}>
        <Layout.Body>
          <Layout.Main width="full">
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
      </ModuleFeature>
    </React.Fragment>
  );
}

const DEFAULT_SORT = {
  field: 'sum(span.self_time)' as const,
  kind: 'desc' as const,
};

function AlertBanner(props: Omit<AlertProps, 'type' | 'showIcon'>) {
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
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  const hasDashboardsPlatformizedQueries = useHasDashboardsPlatformizedQueries();
  if (hasDashboardsPlatformizedQueries) {
    return <PlatformizedQueriesOverview />;
  }
  return (
    <ModulePageProviders
      moduleName="db"
      analyticEventName="insight.page_loads.db"
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <DatabaseLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
