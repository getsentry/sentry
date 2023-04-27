import {CSSProperties} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Badge from 'sentry/components/badge';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {Hovercard} from 'sentry/components/hovercard';
import Link from 'sentry/components/links/link';
import {space} from 'sentry/styles/space';
import ArrayValue from 'sentry/utils/discover/arrayValue';

type Props = {
  isDataLoading: boolean;
  location: Location;
  onSelect: (row: DataRow, rowIndex: number) => void;
  data?: DataRow[];
  selectedRow?: DataRow;
};

export type DataRow = {
  action: string;
  count: number;
  data_keys: Array<string>;
  data_values: Array<string>;
  description: string;
  domain: string;
  epm: number;
  firstSeen: string;
  formatted_desc: string;
  group_id: string;
  lastSeen: string;
  newish: number;
  p75: number;
  retired: number;
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
  data,
  onSelect,
  selectedRow,
  isDataLoading,
}: Props) {
  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    return <span>{column.name}</span>;
  }

  function renderBodyCell(
    column: GridColumnHeader,
    row: DataRow,
    rowIndex: number
  ): React.ReactNode {
    const isSelectedRow = selectedRow?.group_id === row.group_id;
    const rowStyle: CSSProperties | undefined = isSelectedRow
      ? {fontWeight: 'bold'}
      : undefined;

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
      let headerExtra = '';
      if (row.newish === 1) {
        headerExtra = `Query (First seen ${row.firstSeen})`;
      } else if (row.retired === 1) {
        headerExtra = `Query (Last seen ${row.lastSeen})`;
      }
      return (
        <Hovercard header={headerExtra} body={value}>
          <Link onClick={() => onSelect(row, rowIndex)} to="">
            {value.substring(0, 30)}
            {value.length > 30 ? '...' : ''}
            {value.length > 30 ? value.substring(value.length - 30) : ''}
          </Link>
          {row?.newish === 1 && <StyledBadge type="new" text="new" />}
          {row?.retired === 1 && <StyledBadge type="warning" text="old" />}
        </Hovercard>
      );
    }
    if (['p75', 'total_time'].includes(column.key.toString())) {
      return <span style={rowStyle}>{row[column.key].toFixed(2)}ms</span>;
    }
    if (column.key === 'conditions') {
      const value = row.data_values[row.data_keys.indexOf('where')];
      return value ? (
        <Link onClick={() => onSelect(row, rowIndex)} to="">
          {value.length > 60 ? '...' : ''}
          {value.substring(value.length - 60)}
        </Link>
      ) : (
        <span />
      );
    }
    return <span style={rowStyle}>{row[column.key]}</span>;
  }

  return (
    <GridEditable
      isLoading={isDataLoading}
      data={data as any}
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

const StyledBadge = styled(Badge)`
  margin-left: ${space(0.75)};
`;
