import {Fragment} from 'react';
import styled from '@emotion/styled';
import {urlEncode} from '@sentry/utils';
import {Location} from 'history';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {useLocation} from 'sentry/utils/useLocation';
import {TableColumnSort} from 'sentry/views/discover/table/types';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanList} from 'sentry/views/starfish/queries/useSpanList';
import {ModuleName} from 'sentry/views/starfish/types';
import {getModuleFromLocation} from 'sentry/views/starfish/utils/getModuleFromLocation';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';

type Props = {
  moduleName: ModuleName;
  onSetOrderBy: (orderBy: string) => void;
  orderBy: string;
  columnOrder?: TableColumnHeader[];
  endpoint?: string;
  limit?: number;
  method?: string;
  spanCategory?: string;
};

export type SpanDataRow = {
  'p95(span.duration)': number;
  'percentile_percent_change(span.duration, 0.95)': number;
  'span.description': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
  'spm()': number;
  'sps_percent_change()': number;
  'time_spent_percentage()': number;
};

export type Keys =
  | 'span.description'
  | 'span.op'
  | 'span.domain'
  | 'spm()'
  | 'p95(span.duration)'
  | 'sps_percent_change()'
  | 'sum(span.duration)'
  | 'time_spent_percentage()';
export type TableColumnHeader = GridColumnHeader<Keys>;

export default function SpansTable({
  moduleName,
  orderBy,
  onSetOrderBy,
  columnOrder,
  spanCategory,
  endpoint,
  method,
  limit = 25,
}: Props) {
  const location = useLocation();
  const {isLoading, data, pageLinks} = useSpanList(
    moduleName ?? ModuleName.ALL,
    undefined,
    spanCategory,
    orderBy,
    limit
  );

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        data={data}
        columnOrder={columnOrder ?? getColumns(moduleName)}
        columnSortBy={
          orderBy ? [] : [{key: orderBy, order: 'desc'} as TableColumnSort<Keys>]
        }
        grid={{
          renderHeadCell: getRenderHeadCell(orderBy, onSetOrderBy),
          renderBodyCell: (column, row) =>
            renderBodyCell(column, row, location, endpoint, method),
        }}
        location={location}
      />
      <Pagination pageLinks={pageLinks} />
    </Fragment>
  );
}

function getRenderHeadCell(orderBy: string, onSetOrderBy: (orderBy: string) => void) {
  function renderHeadCell(column: TableColumnHeader): React.ReactNode {
    return (
      <SortLink
        align="left"
        canSort
        direction={orderBy === column.key ? 'desc' : undefined}
        onClick={() => {
          onSetOrderBy(`${column.key}`);
        }}
        title={column.name}
        generateSortLink={() => {
          return {
            ...location,
          };
        }}
      />
    );
  }

  return renderHeadCell;
}

function renderBodyCell(
  column: TableColumnHeader,
  row: SpanDataRow,
  location: Location,
  endpoint?: string,
  method?: string
): React.ReactNode {
  if (column.key === 'span.description') {
    return (
      <OverflowEllipsisTextContainer>
        {row['span.group'] ? (
          <Link
            to={`/starfish/${getModuleFromLocation(location)}/span/${row['span.group']}${
              endpoint && method ? `?${urlEncode({endpoint, method})}` : ''
            }`}
          >
            {row['span.description'] || '<null>'}
          </Link>
        ) : (
          row['span.description'] || '<null>'
        )}
      </OverflowEllipsisTextContainer>
    );
  }

  if (column.key === 'time_spent_percentage()') {
    return (
      <TimeSpentCell
        timeSpentPercentage={row['time_spent_percentage()']}
        totalSpanTime={row['sum(span.duration)']}
      />
    );
  }

  if (column.key === 'spm()') {
    return (
      <ThroughputCell
        throughputPerSecond={row['spm()']}
        delta={row['sps_percent_change()']}
      />
    );
  }

  if (column.key === 'p95(span.duration)') {
    return (
      <DurationCell
        milliseconds={row['p95(span.duration)']}
        delta={row['percentile_percent_change(span.duration, 0.95)']}
      />
    );
  }

  return row[column.key];
}

function getDomainHeader(moduleName: ModuleName) {
  if (moduleName === ModuleName.HTTP) {
    return 'Host';
  }
  if (moduleName === ModuleName.DB) {
    return 'Table';
  }
  return 'Domain';
}
function getDescriptionHeader(moduleName: ModuleName) {
  if (moduleName === ModuleName.HTTP) {
    return 'URL';
  }
  if (moduleName === ModuleName.DB) {
    return 'Query';
  }
  return 'Description';
}

function getColumns(moduleName: ModuleName): TableColumnHeader[] {
  const description = getDescriptionHeader(moduleName);

  const domain = getDomainHeader(moduleName);

  const order: TableColumnHeader[] = [
    {
      key: 'span.op',
      name: 'Operation',
      width: 120,
    },
    {
      key: 'span.description',
      name: description,
      width: COL_WIDTH_UNDEFINED,
    },
    ...(moduleName !== ModuleName.ALL
      ? [
          {
            key: 'span.domain',
            name: domain,
            width: COL_WIDTH_UNDEFINED,
          } as TableColumnHeader,
        ]
      : []),
    {
      key: 'spm()',
      name: 'Throughput',
      width: 175,
    },
    {
      key: 'p95(span.duration)',
      name: DataTitles.p95,
      width: 175,
    },
    {
      key: 'time_spent_percentage()',
      name: DataTitles.timeSpent,
      width: COL_WIDTH_UNDEFINED,
    },
  ];

  return order;
}

export const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;
