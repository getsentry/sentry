import React from 'react';
import keyBy from 'lodash/keyBy';

import * as Layout from 'sentry/components/layouts/thirds';
import {DataCategory} from 'sentry/types/core';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {CacheSamplePanel} from 'sentry/views/insights/cache/components/samplePanel';
import {
  isAValidSort,
  TransactionsTable,
} from 'sentry/views/insights/cache/components/tables/transactionsTable';
import {Referrer} from 'sentry/views/insights/cache/referrers';
import {BASE_FILTERS} from 'sentry/views/insights/cache/settings';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import CacheMissRateChartWidget from 'sentry/views/insights/common/components/widgets/cacheMissRateChartWidget';
import CacheThroughputChartWidget from 'sentry/views/insights/common/components/widgets/cacheThroughputChartWidget';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {combineMeta} from 'sentry/views/insights/common/utils/combineMeta';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {ModuleName, SpanFields, SpanFunction} from 'sentry/views/insights/types';

const {CACHE_MISS_RATE} = SpanFunction;
const {CACHE_ITEM_SIZE} = SpanFields;

export function CacheLandingPage() {
  const location = useLocation();

  const sortField = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_SORT]);

  const sort = decodeSorts(sortField).find(isAValidSort) ?? DEFAULT_SORT;
  const cursor = decodeScalar(location.query?.[QueryParameterNames.TRANSACTIONS_CURSOR]);

  useSamplesDrawer({
    Component: <CacheSamplePanel />,
    moduleName: ModuleName.CACHE,
    requiredParams: ['transaction'],
  });

  const {
    isFetching: isTransactionsListFetching,
    data: transactionsList,
    meta: transactionsListMeta,
    error: transactionsListError,
    pageLinks: transactionsListPageLinks,
  } = useSpans(
    {
      search: MutableSearch.fromQueryObject(BASE_FILTERS),
      fields: [
        'project',
        'project.id',
        'transaction',
        'epm()',
        `${CACHE_MISS_RATE}()`,
        'sum(span.self_time)',
        `avg(${CACHE_ITEM_SIZE})`,
      ],
      sorts: [sort],
      cursor,
      limit: TRANSACTIONS_TABLE_ROW_COUNT,
    },
    Referrer.LANDING_CACHE_TRANSACTION_LIST
  );

  const search = `transaction:[${transactionsList.map(({transaction}) => `"${transaction.replaceAll('"', '\\"')}"`).join(',')}] AND is_transaction:true`;

  const {
    data: transactionDurationData,
    error: transactionDurationError,
    meta: transactionDurationMeta,
    isFetching: isTransactionDurationFetching,
  } = useSpans(
    {
      search,
      fields: ['avg(span.duration)', 'transaction'],
      enabled: !isTransactionsListFetching && transactionsList.length > 0,
      noPagination: true,
    },
    Referrer.LANDING_CACHE_TRANSACTION_DURATION
  );

  const transactionDurationsMap = keyBy(transactionDurationData, 'transaction');

  const transactionsListWithDuration =
    transactionsList?.map(transaction => ({
      ...transaction,
      'avg(span.duration)':
        transactionDurationsMap[transaction.transaction]?.['avg(span.duration)']!,
    })) || [];

  const meta = combineMeta(transactionsListMeta, transactionDurationMeta);
  addCustomMeta(meta);

  return (
    <React.Fragment>
      <ModuleFeature moduleName={ModuleName.CACHE}>
        <Layout.Body>
          <Layout.Main width="full">
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ModulePageFilterBar moduleName={ModuleName.CACHE} />
              </ModuleLayout.Full>
              <ModulesOnboarding moduleName={ModuleName.CACHE}>
                <ModuleLayout.Half>
                  <CacheMissRateChartWidget />
                </ModuleLayout.Half>
                <ModuleLayout.Half>
                  <CacheThroughputChartWidget />
                </ModuleLayout.Half>
                <ModuleLayout.Full>
                  <TransactionsTable
                    data={transactionsListWithDuration}
                    isLoading={
                      isTransactionsListFetching || isTransactionDurationFetching
                    }
                    sort={sort}
                    error={transactionsListError || transactionDurationError}
                    meta={meta}
                    pageLinks={transactionsListPageLinks}
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

function PageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName="cache"
      analyticEventName="insight.page_loads.cache"
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <CacheLandingPage />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

// TODO - this won't be needed once we migrate to EAP
const addCustomMeta = (meta?: EventsMetaType) => {
  if (meta?.fields) {
    meta.fields[`avg(${CACHE_ITEM_SIZE})`] = 'size';
    meta.fields[`avg(span.duration)`] = 'duration';
    meta.units[`avg(${CACHE_ITEM_SIZE})`] = 'byte';
  }

  if (meta?.units) {
    meta.units[`avg(span.duration)`] = 'millisecond';
  }
};

const DEFAULT_SORT = {
  field: 'sum(span.self_time)' as const,
  kind: 'desc' as const,
};

const TRANSACTIONS_TABLE_ROW_COUNT = 20;
