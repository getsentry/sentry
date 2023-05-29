import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import TransactionNameSearchBar from 'sentry/components/performance/searchBar';
import Switch from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useApiQuery, useQuery} from 'sentry/utils/queryClient';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  getDbAggregatesQuery,
  useQueryMainTable,
} from 'sentry/views/starfish/modules/databaseModule/queries';
import combineTableDataWithSparklineData from 'sentry/views/starfish/utils/combineTableDataWithSparklineData';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';

import DatabaseTableView, {
  DataRow,
  MainTableSort,
} from '../../components/databaseTableView';

import DatabaseChartView from './databaseChartView';
import QueryDetail from './panel';

export type Sort<T> = {
  direction: 'desc' | 'asc' | undefined;
  sortHeader: T | undefined;
};

function DatabaseModule() {
  const location = useLocation();
  const organization = useOrganization();
  const eventView = EventView.fromLocation(location);
  const [table, setTable] = useState<string>('ALL');
  const [filterNew, setFilterNew] = useState<boolean>(false);
  const [filterOld, setFilterOld] = useState<boolean>(false);
  const [filterOutlier, setFilterOutlier] = useState<boolean>(true);
  const [transaction, setTransaction] = useState<string>('');
  const [sort, setSort] = useState<MainTableSort>({
    direction: undefined,
    sortHeader: undefined,
  });
  const [rows, setRows] = useState<{next?: DataRow; prev?: DataRow; selected?: DataRow}>({
    selected: undefined,
    next: undefined,
    prev: undefined,
  });
  const {
    isLoading: isTableDataLoading,
    data: tableData,
    isRefetching: isTableRefetching,
  } = useQueryMainTable({
    transaction,
    table,
    filterNew,
    filterOld,
    filterOutlier,
    sortKey: sort.sortHeader?.key,
    sortDirection: sort.direction,
  });
  const pageFilters = usePageFilters();

  // Experiments
  const [p95asNumber, setp95asNumber] = useState<boolean>(false);
  const [noP95, setnoP95] = useState<boolean>(false);

  const {selection} = pageFilters;
  const {projects, environments, datetime} = selection;

  useApiQuery<null>(
    [
      `/organizations/${organization.slug}/events-starfish/`,
      {
        query: {
          ...{
            environment: environments,
            project: projects.map(proj => String(proj)),
          },
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
    {
      staleTime: 10,
    }
  );

  const {data: dbAggregateData} = useQuery({
    queryKey: [
      'dbAggregates',
      transaction,
      filterNew,
      filterOld,
      pageFilters.selection.datetime,
    ],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getDbAggregatesQuery({
          datetime: pageFilters.selection.datetime,
          transaction,
        })}`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps(
    pageFilters.selection.datetime
  );

  const combinedDbData = combineTableDataWithSparklineData(
    tableData,
    dbAggregateData,
    moment.duration(12, 'hours'),
    moment(start_timestamp),
    moment(end_timestamp)
  );

  useEffect(() => {
    function handleKeyDown({keyCode}) {
      setRows(currentRow => {
        if (currentRow.selected) {
          if (currentRow.prev && keyCode === 37) {
            return getUpdatedRows(currentRow.prev);
          }
          if (currentRow.next && keyCode === 39) {
            return getUpdatedRows(currentRow.next);
          }
        }
        return currentRow;
      });
    }

    document.addEventListener('keydown', handleKeyDown);

    return function cleanup() {
      document.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableData]);

  const toggleFilterNew = () => {
    setFilterNew(!filterNew);
    if (!filterNew) {
      setFilterOld(false);
    }
  };
  const toggleFilterOld = () => {
    setFilterOld(!filterOld);
    if (!filterOld) {
      setFilterNew(false);
    }
  };
  const toggleOutlier = () => {
    setFilterOutlier(!filterOutlier);
  };
  const toggleNoP95 = () => {
    setnoP95(!noP95);
  };
  const toggleP95asNumber = () => {
    setp95asNumber(!p95asNumber);
  };

  const getUpdatedRows = (row: DataRow, rowIndex?: number) => {
    rowIndex ??= tableData.findIndex(data => data.group_id === row.group_id);
    const prevRow = rowIndex > 0 ? tableData[rowIndex - 1] : undefined;
    const nextRow = rowIndex < tableData.length - 1 ? tableData[rowIndex + 1] : undefined;
    return {selected: row, next: nextRow, prev: prevRow};
  };

  const setSelectedRow = (row: DataRow, rowIndex?: number) => {
    setRows(getUpdatedRows(row, rowIndex));
  };

  const unsetSelectedSpanGroup = () => setRows({selected: undefined});

  const handleSearch = (query: string) => {
    const conditions = new MutableSearch(query);
    const transactionValues = conditions.getFilterValues('transaction');
    if (transactionValues.length) {
      setTransaction(transactionValues[0]);
      return;
    }
    if (conditions.freeText.length > 0) {
      // so no need to wrap it here
      setTransaction(conditions.freeText.join(' '));
      return;
    }
    setTransaction('');
  };

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Database')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <FilterOptionsContainer>
              <DatePageFilter alignDropdown="left" />
            </FilterOptionsContainer>
            <DatabaseChartView location={location} table={table} onChange={setTable} />
            <SearchFilterContainer>
              <LabelledSwitch
                label="Filter New Queries"
                isActive={filterNew}
                size="lg"
                toggle={toggleFilterNew}
              />
              <LabelledSwitch
                label="Filter Old Queries"
                isActive={filterOld}
                size="lg"
                toggle={toggleFilterOld}
              />
              <LabelledSwitch
                label="Exclude Outliers"
                isActive={filterOutlier}
                size="lg"
                toggle={toggleOutlier}
              />
            </SearchFilterContainer>
            <SearchFilterContainer>
              <TransactionNameSearchBar
                organization={organization}
                eventView={eventView}
                onSearch={(query: string) => handleSearch(query)}
                query={transaction}
              />
            </SearchFilterContainer>
            <DatabaseTableView
              location={location}
              data={combinedDbData as DataRow[]}
              isDataLoading={isTableDataLoading || isTableRefetching}
              onSelect={setSelectedRow}
              onSortChange={setSort}
              selectedRow={rows.selected}
              p95asNumber={p95asNumber}
              noP95={noP95}
            />
            <QueryDetail
              isDataLoading={isTableDataLoading || isTableRefetching}
              onRowChange={row => {
                setSelectedRow(row);
              }}
              mainTableSort={sort}
              row={rows.selected}
              nextRow={rows.next}
              prevRow={rows.prev}
              onClose={unsetSelectedSpanGroup}
              transaction={transaction}
            />
            <div>Experiments</div>
            <LabelledSwitch
              label="p95 as number"
              isActive={p95asNumber}
              size="lg"
              toggle={toggleP95asNumber}
            />
            <LabelledSwitch
              label="No p95"
              isActive={noP95}
              size="lg"
              toggle={toggleNoP95}
            />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

export default DatabaseModule;

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

const SearchFilterContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

function LabelledSwitch(props) {
  return (
    <span
      style={{
        display: 'inline-flex',
        gap: space(1),
        paddingRight: space(2),
        alignItems: 'center',
      }}
    >
      <span>{props.label}</span>
      <Switch {...props} />
    </span>
  );
}
