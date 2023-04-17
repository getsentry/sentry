import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable from 'sentry/components/gridEditable';

const ENDPOINT_QUERY = `select description, count() as count
 from spans_experimental_starfish
 where module = 'http'
 group by description
 order by count desc
 limit 10
`;

type Props = {
  location: Location;
};

export default function APIModuleView({location}: Props) {
  const {
    isLoading: areEndpointsLoading,
    error: endpointsError,
    data: endpointsData,
  } = useQuery({
    queryKey: ['URLs'],
    queryFn: () =>
      fetch(`http://localhost:8000/?query=${ENDPOINT_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  if (areEndpointsLoading) {
    return 'LOADING';
  }

  if (endpointsError) {
    return 'ERROR';
  }

  const columnOrder = [
    {
      key: 'description',
      name: 'Transaction',
    },
    {
      key: 'count',
      name: 'Count',
    },
  ];
  const columnSortBy = [];

  return (
    <GridEditable
      isLoading={areEndpointsLoading}
      data={endpointsData}
      columnOrder={columnOrder}
      columnSortBy={columnSortBy}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
      location={location}
    />
  );
}

function renderHeadCell(column): React.ReactNode {
  console.log('rendering head', arguments);

  return <span>{column.name}</span>;
}

function renderBodyCell(column: GridColumn, row: DataRow): React.ReactNode {
  return <span>{row[column.key]}</span>;
}
