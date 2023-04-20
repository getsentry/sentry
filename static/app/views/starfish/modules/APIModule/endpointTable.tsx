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
        renderBodyCell: (column: GridColumnHeader, row: EndpointDataRow) =>
          renderBodyCell(column, row, onSelect),
      }}
      location={location}
    />
  );
}

export function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  // TODO: come up with a better way to identify number columns to align to the right
  if (
    column.key.toString().match(/^p\d\d/) ||
    !['description', 'transaction'].includes(column.key.toString())
  ) {
    return (
      <TextAlignRight>
        <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
      </TextAlignRight>
    );
  }
  return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
}

export function renderBodyCell(
  column: GridColumnHeader,
  row: EndpointDataRow,
  onSelect?: (row: EndpointDataRow) => void
): React.ReactNode {
  if (column.key === 'description' && onSelect) {
    return (
      <Link onClick={() => onSelect(row)} to="">
        {row[column.key]}
      </Link>
    );
  }

  // TODO: come up with a better way to identify number columns to align to the right
  if (column.key.toString().match(/^p\d\d/)) {
    return (
      <TextAlignRight>
        <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />
      </TextAlignRight>
    );
  }
  if (!['description', 'transaction'].includes(column.key.toString())) {
    return (
      <TextAlignRight>
        <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>
      </TextAlignRight>
    );
  }

  return <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>;
}

export const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

export const TextAlignRight = styled('span')`
  text-align: right;
  width: 100%;
`;
