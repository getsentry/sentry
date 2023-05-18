import styled from '@emotion/styled';
import {Location} from 'history';
import moment from 'moment';

import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Series} from 'sentry/types/echarts';
import {TableColumnSort} from 'sentry/views/discover/table/types';
import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {DataRow} from 'sentry/views/starfish/modules/databaseModule/databaseTableView';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

type Props = {
  isLoading: boolean;
  location: Location;
  onSelect: (row: SpanDataRow) => void;
  onSetOrderBy: (orderBy: string) => void;
  orderBy: string;
  queryConditions: string[];
  spansData: SpanDataRow[];
  spansTrendsData: SpanTrendDataRow[];
};

export type SpanDataRow = {
  count: number;
  description: string;
  domain: string;
  group_id: string;
  p50: number;
  p95: number;
  span_operation: string;
  total_exclusive_time: number;
};

export type SpanTrendDataRow = {
  group_id: string;
  interval: string;
  percentile_value: string;
  span_operation: string;
};

export default function SpansTable({
  location,
  spansData,
  orderBy,
  onSetOrderBy,
  queryConditions,
  spansTrendsData,
  isLoading,
  onSelect,
}: Props) {
  const spansTrendsGrouped = {};

  spansTrendsData?.forEach(({group_id, span_operation, interval, percentile_value}) => {
    if (span_operation in spansTrendsGrouped) {
      if (group_id in spansTrendsGrouped[span_operation]) {
        return spansTrendsGrouped[span_operation][group_id].push({
          name: interval,
          value: percentile_value,
        });
      }
      return (spansTrendsGrouped[span_operation][group_id] = [
        {name: interval, value: percentile_value},
      ]);
    }
    return (spansTrendsGrouped[span_operation] = {
      [group_id]: [{name: interval, value: percentile_value}],
    });
  });

  const combinedSpansData = spansData?.map(spanData => {
    const {group_id, span_operation} = spanData;
    if (spansTrendsGrouped[span_operation] === undefined) {
      return spanData;
    }
    const percentile_trend: Series = {
      seriesName: 'percentile_trend',
      data: spansTrendsGrouped[span_operation][group_id],
    };

    const zeroFilled = zeroFillSeries(percentile_trend, moment.duration(1, 'day'));
    return {...spanData, percentile_trend: zeroFilled};
  });

  return (
    <GridEditable
      isLoading={isLoading}
      data={combinedSpansData}
      columnOrder={getColumns(queryConditions)}
      columnSortBy={
        orderBy ? [] : [{key: orderBy, order: 'desc'} as TableColumnSort<string>]
      }
      grid={{
        renderHeadCell: getRenderHeadCell(orderBy, onSetOrderBy),
        renderBodyCell: (column, row) => renderBodyCell(column, row, onSelect),
      }}
      location={location}
    />
  );
}

function getRenderHeadCell(orderBy: string, onSetOrderBy: (orderBy: string) => void) {
  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    return (
      <SortLink
        align="left"
        canSort={column.key !== 'percentile_trend'}
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

const SPAN_OPS_WITH_DETAIL = ['http.client', 'db'];

function renderBodyCell(
  column: GridColumnHeader,
  row: SpanDataRow,
  onSelect?: (row: SpanDataRow) => void
): React.ReactNode {
  if (column.key === 'percentile_trend' && row[column.key]) {
    return (
      <Sparkline
        color={CHART_PALETTE[3][0]}
        series={row[column.key]}
        width={column.width ? column.width - column.width / 5 : undefined}
      />
    );
  }

  if (column.key === 'description') {
    const formattedRow = mapRowKeys(row, row.span_operation);
    return (
      <OverflowEllipsisTextContainer>
        <Link
          onClick={() => onSelect?.(formattedRow)}
          to={
            SPAN_OPS_WITH_DETAIL.includes(row.span_operation)
              ? ''
              : `/starfish/span/${encodeURIComponent(row.group_id)}`
          }
        >
          {row.span_operation === 'db' ? (
            <StyledFormattedCode>
              {(row as unknown as DataRow).formatted_desc}
            </StyledFormattedCode>
          ) : (
            row.description || '<null>'
          )}
        </Link>
      </OverflowEllipsisTextContainer>
    );
  }

  if (column.key.toString().match(/^p\d\d/) || column.key === 'total_exclusive_time') {
    return <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />;
  }

  return row[column.key];
}

// We use different named column keys for the same columns in db and api module
// So we need to map them to the appropriate keys for the module details drawer
// Not ideal, but this is a temporary fix until we match the column keys.
// Also the type for this is not very consistent. We should fix that too.
const mapRowKeys = (row: SpanDataRow, spanOperation: string) => {
  switch (spanOperation) {
    case 'http.client':
      return {
        ...row,
        'p50(span.self_time)': row.p50,
        'p95(span.self_time)': row.p95,
      };
    case 'db':
      return {
        ...row,
        total_time: row.total_exclusive_time,
      };

    default:
      return row;
  }
};

function getDomainHeader(queryConditions: string[]) {
  if (queryConditions.includes("span_operation = 'db'")) {
    return 'Table';
  }
  if (queryConditions.includes("span_operation = 'http.client'")) {
    return 'Host';
  }
  return 'Domain';
}
function getDescriptionHeader(queryConditions: string[]) {
  if (queryConditions.includes("span_operation = 'db'")) {
    return 'Query';
  }
  if (queryConditions.includes("span_operation = 'http.client'")) {
    return 'URL';
  }
  return 'Description';
}

function getColumns(queryConditions: string[]): GridColumnOrder[] {
  const description = getDescriptionHeader(queryConditions);

  const domain = getDomainHeader(queryConditions);

  const doQueryConditionsIncludeDomain = queryConditions.some(condition =>
    condition.includes('domain =')
  );

  const doQueryConditionsIncludeSpanOperation = queryConditions.some(condition =>
    condition.includes('span_operation =')
  );

  const order: Array<GridColumnOrder | false> = [
    !doQueryConditionsIncludeSpanOperation && {
      key: 'span_operation',
      name: 'Operation',
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'description',
      name: description,
      width: COL_WIDTH_UNDEFINED,
    },
    !doQueryConditionsIncludeDomain && {
      key: 'domain',
      name: domain,
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'total_exclusive_time',
      name: 'Total Time',
      width: 250,
    },
    {
      key: 'transactions',
      name: 'Transactions',
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'p50',
      name: 'p50',
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'percentile_trend',
      name: 'p50 Trend',
      width: 250,
    },
  ];

  return order.filter((x): x is GridColumnOrder => Boolean(x));
}

const StyledFormattedCode = styled(FormattedCode)`
  background: none;
  text-overflow: ellipsis;
`;

export const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;
