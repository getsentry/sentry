import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';

import {ENDPOINT_LIST_QUERY} from './queries';

export const HOST = 'http://localhost:8080';

type Props = {
  location: Location;
  onSelect: (row: DataRow) => void;
};

export type DataRow = {
  count: number;
  description: string;
  domain: string;
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

export default function EndpointTable({location, onSelect}: Props) {
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
        renderBodyCell: (column: GridColumnHeader, row: DataRow) =>
          renderBodyCell(column, row, onSelect),
      }}
      location={location}
    />
  );
}

function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
}

function renderBodyCell(
  column: GridColumnHeader,
  row: DataRow,
  onSelect?: (row: DataRow) => void
): React.ReactNode {
  if (column.key === 'description' && onSelect) {
    return (
      <Link onClick={() => onSelect(row)} to="">
        {row[column.key]}
      </Link>
    );
  }
  return <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>;
}

const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;
