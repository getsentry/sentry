import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import SearchBar from 'sentry/components/searchBar';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {escapeFilterValue} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import QueuesLandingLatencyChartWidget from 'sentry/views/insights/common/components/widgets/queuesLandingLatencyChartWidget';
import QueuesLandingThroughputChartWidget from 'sentry/views/insights/common/components/widgets/queuesLandingThroughputChartWidget';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {
  isAValidSort,
  QueuesTable,
} from 'sentry/views/insights/queues/components/tables/queuesTable';
import {ModuleName} from 'sentry/views/insights/types';

const DEFAULT_SORT = {
  field: 'sum(span.duration)' as const,
  kind: 'desc' as const,
};

function QueuesLandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();

  const query = useLocationQuery({
    fields: {
      destination: decodeScalar,
      [QueryParameterNames.DESTINATIONS_SORT]: decodeScalar,
    },
  });

  const sort =
    decodeSorts(query[QueryParameterNames.DESTINATIONS_SORT]).find(isAValidSort) ??
    DEFAULT_SORT;

  const handleSearch = (newDestination: string) => {
    trackAnalytics('insight.general.search', {
      organization,
      query: newDestination,
      source: ModuleName.QUEUE,
    });
    navigate({
      ...location,
      query: {
        ...location.query,
        destination: newDestination === '' ? undefined : newDestination,
        [QueryParameterNames.DESTINATIONS_CURSOR]: undefined,
      },
    });
  };

  // The QueuesTable component queries using the destination prop.
  // We wrap the user input in wildcards to allow for partial matches.
  const wildCardDestinationFilter = query.destination
    ? `*${escapeFilterValue(query.destination)}*`
    : undefined;

  return (
    <Fragment>
      <ModuleFeature moduleName={ModuleName.QUEUE}>
        <Layout.Body>
          <Layout.Main width="full">
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ModulePageFilterBar moduleName={ModuleName.QUEUE} />
              </ModuleLayout.Full>
              <ModulesOnboarding moduleName={ModuleName.QUEUE}>
                <ModuleLayout.Half>
                  <QueuesLandingLatencyChartWidget />
                </ModuleLayout.Half>
                <ModuleLayout.Half>
                  <QueuesLandingThroughputChartWidget />
                </ModuleLayout.Half>
                <ModuleLayout.Full>
                  <Stack gap="xl">
                    <SearchBar
                      query={query.destination}
                      placeholder={t('Search for more destinations')}
                      onSearch={handleSearch}
                    />
                    <QueuesTable sort={sort} destination={wildCardDestinationFilter} />
                  </Stack>
                </ModuleLayout.Full>
              </ModulesOnboarding>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleFeature>
    </Fragment>
  );
}

function PageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName="queue"
      analyticEventName="insight.page_loads.queue"
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <QueuesLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
