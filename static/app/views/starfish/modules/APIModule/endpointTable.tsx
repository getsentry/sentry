import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import Duration from 'sentry/components/duration';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';

import {ENDPOINT_LIST_QUERY} from './queries';

export const HOST = 'http://localhost:8080';

type Props = {
  location: Location;
  onSelect: (row: EndpointDataRow) => void;
};

export type DataRow = {
  count: number;
  description: string;
  domain: string;
};

const COLUMN_ORDER = [
  {
    key: 'description',
    name: 'URL',
    width: 600,
  },
  {
    key: 'p50(exclusive_time)',
    name: 'p50',
  },
  {
    key: 'user_count',
    name: 'Users',
  },
  {
    key: 'transaction_count',
    name: 'Transactions',
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

export function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
}

export function renderBodyCell(
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

  if (column.key.toString().match(/^p\d\d/)) {
    return <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />;
  }

  return <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>;
}

const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;
