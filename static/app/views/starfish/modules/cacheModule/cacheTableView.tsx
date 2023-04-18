import {Link} from 'react-router';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';

const HOST = 'http://localhost:8080';

export type DataRow = {
  desc: string;
  epm: number;
  p75: number;
  total_time: number;
  transactions: number;
};

type Props = {
  location: Location;
  operation: string;
  setSelectedRow: (row: DataRow) => void;
  transaction: string;
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

export default function CacheModuleView({
  location,
  operation,
  transaction,
  setSelectedRow,
}: Props) {
  const ENDPOINT_QUERY = `select description as desc, (divide(count(), divide(1209600.0, 60)) AS epm), quantile(0.75)(exclusive_time) as p75,
  uniq(transaction) as transactions,
  sum(exclusive_time) as total_time
    from default.spans_experimental_starfish
    where module == 'cache' and operation='${operation}'
    group by description
    limit 100
  `;

  const renderBodyCell = (column: GridColumnHeader, row: DataRow) => {
    if (column.key === 'desc') {
      return (
        <Link
          to={`/starfish/cache/?query=${row.desc}`}
          aria-label={t('See query summary')}
          onClick={() => setSelectedRow(row)}
        >
          <span>{row[column.key]}</span>
        </Link>
      );
    }
    return <span>{row[column.key]}</span>;
  };

  const {isLoading: areEndpointsLoading, data: endpointsData} = useQuery({
    queryKey: ['endpoints', operation, transaction],
    queryFn: () => fetch(`${HOST}/?query=${ENDPOINT_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

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

function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  return <span>{column.name}</span>;
}
