import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import qs from 'qs';

import DatePageFilter from 'sentry/components/datePageFilter';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import EndpointTable from 'sentry/views/starfish/modules/APIModule/endpointTable';
import DatabaseTableView from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {getMainTable} from 'sentry/views/starfish/modules/databaseModule/queries';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';

const HTTP_SPAN_COLUMN_ORDER = [
  {
    key: 'description',
    name: 'URL',
    width: 400,
  },
  {
    key: 'throughput',
    name: 'Throughput',
    width: 350,
  },
  {
    key: 'p50(exclusive_time)',
    name: 'p50',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'transaction_count',
    name: 'Transactions',
    width: COL_WIDTH_UNDEFINED,
  },

  {
    key: 'total_exclusive_time',
    name: 'Total Time',
    width: COL_WIDTH_UNDEFINED,
  },
];

const DATABASE_SPAN_COLUMN_ORDER = [
  {
    key: 'description',
    name: 'Query',
    width: 400,
  },
  {
    key: 'domain',
    name: 'Table',
    width: 100,
  },
  {
    key: 'epm',
    name: 'Tpm',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p75',
    name: 'p75',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'total_time',
    name: 'Total Time',
    width: COL_WIDTH_UNDEFINED,
  },
];

export default function EndpointOverview({transaction: _}: {transaction: string}) {
  const location = useLocation();
  const pageFilter = usePageFilters();

  const transaction = '/api/0/organizations/{organization_slug}/issues/';
  const {startTime, endTime} = getDateFilters(pageFilter);
  const transactionFilter =
    transaction.length > 0 ? `transaction='${transaction}'` : null;

  const {
    isLoading: isTableDataLoading,
    data: tableData,
    isRefetching: isTableRefetching,
  } = useQuery({
    queryKey: ['endpoints', pageFilter.selection.datetime, transaction],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getMainTable(startTime, endTime, transactionFilter)}&format=sql`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Endpoint Overview')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <SearchContainerWithFilterAndMetrics>
            <PageFilterBar condensed>
              <DatePageFilter alignDropdown="left" />
            </PageFilterBar>
          </SearchContainerWithFilterAndMetrics>

          <Layout.Main fullWidth>
            <PageErrorAlert />
            <SubHeader>{t('HTTP Spans')}</SubHeader>
            <EndpointTable
              location={location}
              onSelect={r => {
                browserHistory.push(
                  `/starfish/span/${encodeURIComponent(r.group_id)}/?${qs.stringify({
                    transaction,
                  })}`
                );
              }}
              columns={HTTP_SPAN_COLUMN_ORDER}
              filterOptions={{
                action: '',
                domain: '',
                transaction,
                datetime: pageFilter.selection.datetime,
              }}
            />
            <SubHeader>{t('Database Spans')}</SubHeader>
            <DatabaseTableView
              location={location}
              onSelect={r => {
                browserHistory.push(
                  `/starfish/span/${encodeURIComponent(r.group_id)}/?${qs.stringify({
                    transaction,
                  })}`
                );
              }}
              isDataLoading={isTableDataLoading || isTableRefetching}
              data={tableData}
              columns={DATABASE_SPAN_COLUMN_ORDER}
            />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 0;
  margin-bottom: ${space(1)};
`;

const SearchContainerWithFilterAndMetrics = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;
