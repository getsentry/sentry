import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';

import {ENDPOINT_LIST_QUERY} from './queries';

const HOST = 'http://localhost:8080';

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
    queryFn: () => fetch(`${HOST}/?query=${ENDPOINT_LIST_QUERY}`).then(res => res.json()),
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
