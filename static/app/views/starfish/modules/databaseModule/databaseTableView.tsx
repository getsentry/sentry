import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';

const HOST = 'http://localhost:8080';

type Props = {
  action: string;
  location: Location;
  transaction: string;
};

export type DataRow = {
  count: number;
  description: string;
};

const COLUMN_ORDER = [
  {
    key: 'desc',
    name: 'Query',
    width: 600,
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

export default function APIModuleView({location, action, transaction}: Props) {
  const transactionFilter =
    transaction.length > 0 ? `and transaction='${transaction}'` : '';
  const ENDPOINT_QUERY = `select description as desc, (divide(count(), divide(1209600.0, 60)) AS epm), quantile(0.75)(exclusive_time) as p75,
    uniq(transaction) as transactions,
    sum(exclusive_time) as total_time
    from default.spans_experimental_starfish
    where startsWith(span_operation, 'db') and span_operation != 'db.redis' and action='${action}' ${transactionFilter}
    group by description
    order by -pow(10, floor(log10(count()))), -quantile(0.5)(exclusive_time)
    limit 100
  `;

  const {isLoading: areEndpointsLoading, data: endpointsData} = useQuery({
    queryKey: ['endpoints', action, transaction],
    queryFn: () => fetch(`${HOST}/?query=${ENDPOINT_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    return <span>{column.name}</span>;
  }

  function renderBodyCell(column: GridColumnHeader, row: DataRow): React.ReactNode {
    if (column.key === 'desc') {
      return (
        <Link onClick={() => onSelect(row)} to="">
          {row[column.key]}
        </Link>
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
