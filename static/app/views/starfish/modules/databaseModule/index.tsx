import {useState} from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getMainTable} from 'sentry/views/starfish/modules/databaseModule/queries';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';

import DatabaseChartView from './databaseChartView';
import DatabaseTableView, {DataRow} from './databaseTableView';
import QueryDetail from './panel';

const HOST = 'http://localhost:8080';

function DatabaseModule() {
  const location = useLocation();
  const [action, setAction] = useState<string>('ALL');
  const [table, setTable] = useState<string>('ALL');
  const [rows, setRows] = useState<{next?: DataRow; prev?: DataRow; selected?: DataRow}>({
    selected: undefined,
    next: undefined,
    prev: undefined,
  });

  const tableFilter = table !== 'ALL' ? `domain = '${table}'` : undefined;
  const actionFilter = action !== 'ALL' ? `action = '${action}'` : undefined;

  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const DATE_FILTERS = `
  greater(start_timestamp, fromUnixTimestamp(${startTime.unix()})) and
  less(start_timestamp, fromUnixTimestamp(${endTime.unix()}))
`;

  const {
    isLoading: isTableDataLoading,
    data: tableData,
    isRefetching: isTableRefetching,
  } = useQuery<DataRow[]>({
    queryKey: ['endpoints', action, table, pageFilter.selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getMainTable(
          startTime,
          DATE_FILTERS,
          endTime,
          '',
          tableFilter,
          actionFilter
        )}&format=sql`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const setSelectedRow = (row: DataRow, rowIndex?: number) => {
    rowIndex ??= tableData.findIndex(data => data.group_id === row.group_id);
    const prevRow = rowIndex > 0 ? tableData[rowIndex - 1] : undefined;
    const nextRow = rowIndex < tableData.length - 1 ? tableData[rowIndex + 1] : undefined;
    setRows({selected: row, next: nextRow, prev: prevRow});
  };

  const unsetSelectedSpanGroup = () => setRows({selected: undefined});

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
            <DatabaseChartView
              location={location}
              action={action}
              table={table}
              onChange={(key, val) => {
                if (key === 'action') {
                  setAction(val);
                  setTable('ALL');
                } else {
                  setTable(val);
                }
              }}
            />
            <DatabaseTableView
              location={location}
              data={tableData}
              isDataLoading={isTableDataLoading || isTableRefetching}
              onSelect={setSelectedRow}
              selectedRow={rows.selected}
            />
            <QueryDetail
              isDataLoading={isTableDataLoading || isTableRefetching}
              onRowChange={row => {
                setSelectedRow(row);
              }}
              row={rows.selected}
              nextRow={rows.next}
              prevRow={rows.prev}
              onClose={unsetSelectedSpanGroup}
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
