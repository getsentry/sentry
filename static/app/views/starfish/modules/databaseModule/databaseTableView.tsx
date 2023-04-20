import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import ArrayValue from 'sentry/utils/discover/arrayValue';

const HOST = 'http://localhost:8080';

type Props = {
  action: string;
  location: Location;
  onSelect: (row: DataRow) => void;
  table: string;
  transaction: string;
};

export type DataRow = {
  data_keys: Array<string>;
  data_values: Array<string>;
  desc: string;
  epm: number;
  p75: number;
  total_time: number;
  transactions: number;
};

const COLUMN_ORDER = [
  {
    key: 'action',
    name: 'Operation',
  },
  {
    key: 'domain',
    name: 'Table',
    width: 200,
  },
  {
    key: 'conditions',
    name: 'Conditions',
    width: 400,
  },
  {
    key: 'epm',
    name: 'tpm',
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
    transaction.length > 0 ? `and transaction='${transaction}'` : '';
  const ENDPOINT_QUERY = `select description as desc, (divide(count(), divide(1209600.0, 60)) AS epm), quantile(0.75)(exclusive_time) as p75,
    uniq(transaction) as transactions,
    sum(exclusive_time) as total_time,
    domain,
    action,
    data_keys,
    data_values
    from default.spans_experimental_starfish
    where startsWith(span_operation, 'db') and span_operation != 'db.redis' and action='${action}' and domain='${table}' ${transactionFilter}
    group by action, description, domain, data_keys, data_values
    order by -pow(10, floor(log10(count()))), -quantile(0.5)(exclusive_time)
    limit 100
  `;

  const {isLoading: areEndpointsLoading, data: endpointsData} = useQuery({
    queryKey: ['endpoints', action, transaction, table],
    queryFn: () => fetch(`${HOST}/?query=${ENDPOINT_QUERY}`).then(res => res.json()),
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
    if (column.key === 'conditions') {
      const value = row.data_values[row.data_keys.indexOf('where')];
      const prefix = value.length > 60 ? '...' : '';
      return value ? (
        <Link onClick={() => onSelect(row)} to="">
          {prefix}
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
