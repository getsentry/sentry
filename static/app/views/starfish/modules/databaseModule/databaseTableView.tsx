import {CSSProperties, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Badge from 'sentry/components/badge';
import GridEditable, {GridColumnHeader} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {getDuration} from 'sentry/utils/formatters';
import Sparkline, {
  generateHorizontalLine,
} from 'sentry/views/starfish/components/sparkline';
import {Sort} from 'sentry/views/starfish/modules/databaseModule';
import {SortableHeader} from 'sentry/views/starfish/modules/databaseModule/panel/queryTransactionTable';

type Props = {
  isDataLoading: boolean;
  location: Location;
  onSelect: (row: DataRow, rowIndex: number) => void;
  columns?: any;
  data?: DataRow[];
  noP95?: boolean;
  onSortChange?: ({direction, sortHeader}: MainTableSort) => void;
  p95asNumber?: boolean;
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
  p50_trend: Series;
  p75: number;
  p95: number;
  p95_trend: Series;
  retired: number;
  throughput: Series;
  total_time: number;
  transactions: number;
};

export type Keys =
  | 'description'
  | 'domain'
  | 'p50'
  | 'p95'
  | 'epm'
  | 'p95'
  | 'transactions'
  | 'total_time';
export type TableColumnHeader = GridColumnHeader<Keys>;
export type MainTableSort = Sort<TableColumnHeader>;

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
  p95asNumber,
  noP95,
  onSortChange,
  selectedRow,
  isDataLoading,
  columns,
}: Props) {
  const [sort, setSort] = useState<{
    direction: 'desc' | 'asc' | undefined;
    sortHeader: TableColumnHeader | undefined;
  }>({direction: undefined, sortHeader: undefined});
  const theme = useTheme();
  let COLUMN_ORDER: TableColumnHeader[] = [
    {
      key: 'description',
      name: 'Query',
      width: 550,
    },
    {
      key: 'domain',
      name: 'Table',
      width: 175,
    },
    {
      key: 'epm',
      name: 'Throughput (SPM)',
      width: 175,
    },
    {
      key: 'p50',
      name: 'P50',
      width: 175,
    },
    {
      key: 'p95',
      name: 'P95',
      width: !p95asNumber ? 175 : undefined,
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
  if (noP95) {
    COLUMN_ORDER = COLUMN_ORDER.filter(col => col.key !== 'p95');
  }

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

    if (key === 'description') {
      const value = row.description;
      return (
        <Link onClick={() => onSelect(row, rowIndex)} to="" style={rowStyle}>
          {value.substring(0, 30)}
          {value.length > 30 ? '...' : ''}
          {value.length > 30 ? value.substring(value.length - 30) : ''}
          {renderBadge(row, selectedRow)}
        </Link>
      );
    }

    if (key === 'epm') {
      const horizontalLine = generateHorizontalLine('', row.epm, theme);
      return (
        <GraphRow>
          <span style={rowStyle}>{row.epm.toFixed(2)}</span>
          <Graphline>
            <Sparkline
              color={CHART_PALETTE[3][0]}
              series={row.throughput}
              markLine={horizontalLine}
              width={column.width ? column.width - column.width / 5 - 50 : undefined}
            />
          </Graphline>
        </GraphRow>
      );
    }

    if (key === 'p50') {
      const horizontalLine = generateHorizontalLine('', row.p50, theme);
      return (
        <GraphRow>
          <span style={rowStyle}>{getDuration(row.p50 / 1000, 2, true)}</span>
          <Graphline>
            <Sparkline
              color={CHART_PALETTE[3][1]}
              series={row.p50_trend}
              markLine={horizontalLine}
              width={column.width ? column.width - column.width / 5 - 50 : undefined}
            />
          </Graphline>
        </GraphRow>
      );
    }

    if (key === 'p95') {
      const horizontalLine = generateHorizontalLine('', row.p95, theme);
      return (
        <GraphRow>
          <span style={rowStyle}>{getDuration(row.p95 / 1000, 2, true)}</span>
          <Graphline>
            {!p95asNumber && (
              <Sparkline
                color={CHART_PALETTE[3][2]}
                series={row.p95_trend}
                markLine={horizontalLine}
                width={column.width ? column.width - column.width / 5 - 50 : undefined}
              />
            )}
          </Graphline>
        </GraphRow>
      );
    }

    if (key === 'total_time') {
      return <span style={rowStyle}>{getDuration(row.total_time / 1000, 2, true)}</span>;
    }
    return <span style={rowStyle}>{row[key]}</span>;
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

const Graphline = styled('div')`
  margin-left: auto;
`;
const GraphRow = styled('div')`
  display: inline-flex;
`;
