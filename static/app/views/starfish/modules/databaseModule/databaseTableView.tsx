import {CSSProperties, useState} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Badge from 'sentry/components/badge';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import {Hovercard} from 'sentry/components/hovercard';
import Link from 'sentry/components/links/link';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {Sort} from 'sentry/views/starfish/modules/databaseModule';
import {SortableHeader} from 'sentry/views/starfish/modules/databaseModule/panel/queryTransactionTable';

import {highlightSql} from './panel';

type Props = {
  isDataLoading: boolean;
  location: Location;
  onSelect: (row: DataRow, rowIndex: number) => void;
  columns?: any;
  data?: DataRow[];
  onSortChange?: ({direction, sortHeader}: MainTableSort) => void;
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
  p50: number;
  p75: number;
  p95: number;
  retired: number;
  total_time: number;
  transactions: number;
};

export type Keys =
  | 'description'
  | 'domain'
  | 'throughput'
  | 'p75_trend'
  | 'epm'
  | 'p50'
  | 'p95'
  | 'transactions'
  | 'total_time';
export type TableColumnHeader = GridColumnHeader<Keys>;
export type MainTableSort = Sort<TableColumnHeader>;

const COLUMN_ORDER: TableColumnHeader[] = [
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
    key: 'throughput',
    name: 'Throughput',
    width: 200,
  },
  {
    key: 'p75_trend',
    name: 'P75 Trend',
    width: 200,
  },
  {
    key: 'epm',
    name: 'Tpm',
  },
  {
    key: 'p50',
    name: 'p50',
  },
  {
    key: 'p95',
    name: 'p95',
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

export function similarity(value: string, other: string): number {
  // If they're identical we don't care
  if (value === other || other === undefined || value === undefined) {
    return -1;
  }
  const short_words = value.length < other.length ? value.split(' ') : other.split(' ');
  const long_words = value.length > other.length ? value.split(' ') : other.split(' ');
  const total = long_words.length;
  let count = 0;
  while (long_words.length > 0) {
    const word = long_words.pop();
    if (word && short_words.includes(word)) {
      count += 1;
      short_words.splice(short_words.indexOf(word), 1);
    }
  }

  return count / total;
}

function renderBadge(row, selectedRow) {
  const similar = similarity(selectedRow?.description, row.description) > 0.8;
  const newish = row?.newish === 1;
  const retired = row?.retired === 1;
  let response: React.ReactNode | null = null;
  if (similar) {
    if (newish && selectedRow.newish !== 1) {
      response = (
        <span>
          <StyledBadge type="new" text="new" />
          <StyledBadge type="alpha" text="similar" />
        </span>
      );
    } else if (retired && selectedRow.retired !== 1) {
      response = (
        <span>
          <StyledBadge type="warning" text="old" />
          <StyledBadge type="alpha" text="similar" />
        </span>
      );
    } else {
      response = <StyledBadge type="alpha" text="similar" />;
    }
  } else if (newish) {
    response = <StyledBadge type="new" text="new" />;
  } else if (retired) {
    response = <StyledBadge type="warning" text="old" />;
  }
  return response;
}

export default function DatabaseTableView({
  location,
  data,
  onSelect,
  onSortChange,
  selectedRow,
  isDataLoading,
  columns,
}: Props) {
  const [sort, setSort] = useState<{
    direction: 'desc' | 'asc' | undefined;
    sortHeader: TableColumnHeader | undefined;
  }>({direction: undefined, sortHeader: undefined});

  function onSortClick(col: TableColumnHeader) {
    let direction: 'desc' | 'asc' | undefined = undefined;
    if (!sort.direction || col.key !== sort.sortHeader?.key) {
      direction = 'desc';
    } else if (sort.direction === 'desc') {
      direction = 'asc';
    }
    if (onSortChange) {
      setSort({direction, sortHeader: col});
      onSortChange({direction, sortHeader: col});
    }
  }

  function renderHeadCell(col: TableColumnHeader): React.ReactNode {
    const sortableKeys: Keys[] = [
      'p50',
      'p95',
      'epm',
      'total_time',
      'domain',
      'transactions',
    ];
    if (sortableKeys.includes(col.key)) {
      const isBeingSorted = col.key === sort.sortHeader?.key;
      const direction = isBeingSorted ? sort.direction : undefined;
      return (
        <SortableHeader
          onClick={() => onSortClick(col)}
          direction={direction}
          title={col.name}
        />
      );
    }
    return <span>{col.name}</span>;
  }

  function renderBodyCell(
    column: TableColumnHeader,
    row: DataRow,
    rowIndex: number
  ): React.ReactNode {
    const {key} = column;

    const isSelectedRow = selectedRow?.group_id === row.group_id;
    const rowStyle: CSSProperties | undefined = isSelectedRow
      ? {fontWeight: 'bold'}
      : undefined;
    const value = row[key];

    if (key === 'description') {
      let headerExtra = '';
      if (row.newish === 1) {
        headerExtra = `Query (First seen ${row.firstSeen})`;
      } else if (row.retired === 1) {
        headerExtra = `Query (Last seen ${row.lastSeen})`;
      }
      return (
        <Hovercard header={headerExtra} body={highlightSql(row.formatted_desc, row)}>
          <Link onClick={() => onSelect(row, rowIndex)} to="" style={rowStyle}>
            {value.substring(0, 30)}
            {value.length > 30 ? '...' : ''}
            {value.length > 30 ? value.substring(value.length - 30) : ''}
          </Link>
          {renderBadge(row, selectedRow)}
        </Hovercard>
      );
    }

    const timeBasedKeys: Keys[] = ['p50', 'p95', 'total_time'];
    if (timeBasedKeys.includes(key)) {
      return <span style={rowStyle}>{value.toFixed(2)}ms</span>;
    }

    if (key === 'throughput') {
      return (
        <Sparkline
          color={CHART_PALETTE[3][0]}
          series={value}
          width={column.width ? column.width - column.width / 5 : undefined}
        />
      );
    }

    if (key === 'p75_trend') {
      return (
        <Sparkline
          color={CHART_PALETTE[3][3]}
          series={value}
          width={column.width ? column.width - column.width / 5 : undefined}
        />
      );
    }

    return <span style={rowStyle}>{value}</span>;
  }

  return (
    <GridEditable
      isLoading={isDataLoading}
      data={data as any}
      columnOrder={columns ?? COLUMN_ORDER}
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
