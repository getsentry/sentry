import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';

const HOST = 'http://localhost:8080';

const ENDPOINT_QUERY = `SELECT description, count() AS count
 FROM spans_experimental_starfish
 WHERE module = 'http'
 GROuP BY description
 ORDER BY count DESC
 LIMIT 10
`;

type Props = {
  location: Location;
};

type DataRow = {
  count: number;
  description: string;
};

const COLUMN_ORDER = [
  {
    key: 'description',
    name: 'Transaction',
    width: 600,
  },
  {
    key: 'count',
    name: 'Count',
  },
];

export default function APIModuleView({location}: Props) {
  const {isLoading: areEndpointsLoading, data: endpointsData} = useQuery({
    queryKey: ['endpoints'],
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

function renderBodyCell(column: GridColumnHeader, row: DataRow): React.ReactNode {
  return <span>{row[column.key]}</span>;
}
