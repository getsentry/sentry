import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {Hovercard} from 'sentry/components/hovercard';
import Link from 'sentry/components/links/link';
import ArrayValue from 'sentry/utils/discover/arrayValue';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getMainTable} from 'sentry/views/starfish/modules/databaseModule/queries';
import {getDateFilters} from 'sentry/views/starfish/utils/dates';

const HOST = 'http://localhost:8080';

type Props = {
  location: Location;
  onSelect: (row: DataRow) => void;
  transaction: string;
  action?: string;
  table?: string;
};

export type DataRow = {
  data_keys: Array<string>;
  data_values: Array<string>;
  description: string;
  epm: number;
  formatted_desc: string;
  group_id: string;
  p75: number;
  total_time: number;
  transactions: number;
};

const COLUMN_ORDER = [
  {
    key: 'description',
    name: 'Query',
    width: 600,
  },
  {
    key: 'domain',
    name: 'Table',
    width: 200,
  },
  {
    key: 'epm',
    name: 'Tpm',
  },
  {
    key: 'p75',
    name: 'p75',
  },
  {
    key: 'transactions',
    name: 'transactions',
  },
  {
    key: 'total_time',
    name: 'Total Time',
  },
];

export default function APIModuleView({
  location,
  action,
  transaction,
  onSelect,
  table,
}: Props) {
  const transactionFilter =
    transaction.length > 0 ? `transaction='${transaction}'` : null;
  const tableFilter = table ? `domain = '${table}'` : null;
  const actionFilter = action ? `action = '${action}'` : null;

  const pageFilter = usePageFilters();
  const {startTime, endTime} = getDateFilters(pageFilter);
  const DATE_FILTERS = `
    start_timestamp > fromUnixTimestamp(${startTime.unix()}) and
    start_timestamp < fromUnixTimestamp(${endTime.unix()})
  `;

  const {isLoading: areEndpointsLoading, data: endpointsData} = useQuery({
    queryKey: ['endpoints', action, transaction, table, pageFilter.selection.datetime],
    queryFn: () =>
      fetch(
        `${HOST}/?query=${getMainTable(
          DATE_FILTERS,
          transactionFilter,
          tableFilter,
          actionFilter,
          startTime,
          endTime
        )}&format=sql`
      ).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    return <span>{column.name}</span>;
  }

  function renderBodyCell(column: GridColumnHeader, row: DataRow): React.ReactNode {
    if (column.key === 'columns') {
      const value = row.data_values[row.data_keys.indexOf('columns')];
      return value ? <ArrayValue value={value?.split(',')} /> : <span />;
    }
    if (column.key === 'order') {
      const value = row.data_values[row.data_keys.indexOf('order')];
      return value ? <ArrayValue value={value?.split(',')} /> : <span />;
    }
    if (column.key === 'description') {
      const value = row[column.key];
      return (
        <Hovercard header="Query" body={value}>
          <Link onClick={() => onSelect(row)} to="">
            {value.substring(0, 30)}
            {value.length > 30 ? '...' : ''}
            {value.length > 30 ? value.substring(value.length - 30) : ''}
          </Link>
        </Hovercard>
      );
    }
    if (['p75', 'total_time'].includes(column.key.toString())) {
      return <span>{row[column.key].toFixed(2)}ms</span>;
    }
    if (column.key === 'conditions') {
      const value = row.data_values[row.data_keys.indexOf('where')];
      return value ? (
        <Link onClick={() => onSelect(row)} to="">
          {value.length > 60 ? '...' : ''}
          {value.substring(value.length - 60)}
        </Link>
      ) : (
        <span />
      );
    }
    return <span>{row[column.key]}</span>;
  }

  return (
    <GridEditable
      isLoading={areEndpointsLoading}
      data={endpointsData}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
      location={location}
    />
  );
}
