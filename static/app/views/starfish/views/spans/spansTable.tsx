import {Theme, useTheme} from '@emotion/react';
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
import {getDuration} from 'sentry/utils/formatters';
import {TableColumnSort} from 'sentry/views/discover/table/types';
import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import Sparkline, {
  generateHorizontalLine,
} from 'sentry/views/starfish/components/sparkline';
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
  epm: number;
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
  const theme = useTheme();
  const spansTrendsGrouped = {p50_trend: {}, p95_trend: {}, throughput: {}};

  spansTrendsData?.forEach(({group_id, span_operation, interval, ...rest}) => {
    ['p50_trend', 'p95_trend', 'throughput'].forEach(trend => {
      if (span_operation in spansTrendsGrouped[trend]) {
        if (group_id in spansTrendsGrouped[trend][span_operation]) {
          return spansTrendsGrouped[trend][span_operation][group_id].push({
            name: interval,
            value: rest[trend],
          });
        }
        return (spansTrendsGrouped[trend][span_operation][group_id] = [
          {name: interval, value: rest[trend]},
        ]);
      }
      return (spansTrendsGrouped[trend][span_operation] = {
        [group_id]: [{name: interval, value: rest[trend]}],
      });
    });
  });

  const combinedSpansData = spansData?.map(spanData => {
    const {group_id, span_operation} = spanData;
    if (spansTrendsGrouped.p50_trend?.[span_operation] === undefined) {
      return spanData;
    }
    const p50_trend: Series = {
      seriesName: 'p50_trend',
      data: spansTrendsGrouped.p50_trend[span_operation][group_id],
    };
    const p95_trend: Series = {
      seriesName: 'p95_trend',
      data: spansTrendsGrouped.p95_trend[span_operation][group_id],
    };
    const throughput_trend: Series = {
      seriesName: 'throughput_trend',
      data: spansTrendsGrouped.throughput[span_operation][group_id],
    };

    const zeroFilledP50 = zeroFillSeries(p50_trend, moment.duration(1, 'day'));
    const zeroFilledP95 = zeroFillSeries(p95_trend, moment.duration(1, 'day'));
    const zeroFilledThroughput = zeroFillSeries(
      throughput_trend,
      moment.duration(1, 'day')
    );
    return {
      ...spanData,
      p50_trend: zeroFilledP50,
      p95_trend: zeroFilledP95,
      throughput_trend: zeroFilledThroughput,
    };
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
        renderBodyCell: (column, row) => renderBodyCell(column, row, theme, onSelect),
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
  column: GridColumnHeader,
  row: SpanDataRow,
  theme: Theme,
  onSelect?: (row: SpanDataRow) => void
): React.ReactNode {
  if (column.key === 'throughput_trend' && row[column.key]) {
    const horizontalLine = generateHorizontalLine(
      `${row.epm.toFixed(2)}`,
      row.epm,
      theme
    );
    return (
      <Sparkline
        color={CHART_PALETTE[3][0]}
        series={row[column.key]}
        width={column.width ? column.width - column.width / 5 : undefined}
        markLine={horizontalLine}
      />
    );
  }

  if (column.key === 'p50_trend' && row[column.key]) {
    const horizontalLine = generateHorizontalLine(
      `${getDuration(row.p50 / 1000, 2, true)}`,
      row.p50,
      theme
    );
    return (
      <Sparkline
        color={CHART_PALETTE[3][1]}
        series={row[column.key]}
        width={column.width ? column.width - column.width / 5 : undefined}
        markLine={horizontalLine}
      />
    );
  }

  if (column.key === 'p95_trend' && row[column.key]) {
    const horizontalLine = generateHorizontalLine(
      `${getDuration(row.p95 / 1000, 2, true)}`,
      row.p95,
      theme
    );
    return (
      <Sparkline
        color={CHART_PALETTE[3][2]}
        series={row[column.key]}
        width={column.width ? column.width - column.width / 5 : undefined}
        markLine={horizontalLine}
      />
    );
  }

  if (column.key === 'description') {
    const formattedRow = mapRowKeys(row, row.span_operation);
    return (
      <OverflowEllipsisTextContainer>
        <Link onClick={() => onSelect?.(formattedRow)} to="">
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
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'transactions',
      name: 'Transactions',
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'throughput_trend',
      name: 'throughput (spm)',
      width: 175,
    },
    {
      key: 'p50_trend',
      name: 'p50 trend',
      width: 175,
    },
    {
      key: 'p95_trend',
      name: 'p95 trend',
      width: 175,
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
