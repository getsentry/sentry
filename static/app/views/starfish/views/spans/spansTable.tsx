import {Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import {Series} from 'sentry/types/echarts';
import {formatPercentage, getDuration} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import {TableColumnSort} from 'sentry/views/discover/table/types';
import {DURATION_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import Sparkline, {
  generateHorizontalLine,
} from 'sentry/views/starfish/components/sparkline';
import {useApplicationMetrics} from 'sentry/views/starfish/queries/useApplicationMetrics';
import {ModuleName} from 'sentry/views/starfish/types';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

type Props = {
  isLoading: boolean;
  moduleName: ModuleName;
  onSetOrderBy: (orderBy: string) => void;
  orderBy: string;
  spansData: SpanDataRow[];
  spansTrendsData: SpanTrendDataRow[];
  columnOrder?: GridColumnOrder[];
};

export type SpanDataRow = {
  count: number;
  description: string;
  domain: string;
  epm: number;
  formatted_desc: string;
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
  moduleName,
  spansData,
  orderBy,
  onSetOrderBy,
  spansTrendsData,
  isLoading,
  columnOrder,
}: Props) {
  const location = useLocation();
  const theme = useTheme();
  const {data: applicationMetrics} = useApplicationMetrics();

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
      app_impact: formatPercentage(
        spanData.total_exclusive_time / applicationMetrics['sum(span.duration)']
      ),
      p50_trend: zeroFilledP50,
      p95_trend: zeroFilledP95,
      throughput_trend: zeroFilledThroughput,
    };
  });

  return (
    <GridEditable
      isLoading={isLoading}
      data={combinedSpansData}
      columnOrder={columnOrder ?? getColumns(moduleName)}
      columnSortBy={
        orderBy ? [] : [{key: orderBy, order: 'desc'} as TableColumnSort<string>]
      }
      grid={{
        renderHeadCell: getRenderHeadCell(orderBy, onSetOrderBy),
        renderBodyCell: (column, row) => renderBodyCell(column, row, theme),
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
  theme: Theme
): React.ReactNode {
  if (column.key === 'throughput_trend' && row[column.key]) {
    const horizontalLine = generateHorizontalLine(
      `${row.epm.toFixed(2)}`,
      row.epm,
      theme
    );
    return (
      <Sparkline
        color={THROUGHPUT_COLOR}
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
        color={DURATION_COLOR}
        series={row[column.key]}
        width={column.width ? column.width - column.width / 5 : undefined}
        markLine={horizontalLine}
      />
    );
  }

  if (column.key === 'description') {
    return (
      <OverflowEllipsisTextContainer>
        <Link to={`/starfish/span/${row.group_id}`}>
          {row.span_operation === 'db' ? (
            <StyledFormattedCode>
              {(row as unknown as SpanDataRow).formatted_desc}
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
export const mapRowKeys = (row: SpanDataRow, spanOperation: string) => {
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

function getColumns(moduleName: ModuleName): GridColumnOrder[] {
  const description = getDescriptionHeader(moduleName);

  const domain = getDomainHeader(moduleName);

  const order: Array<GridColumnOrder | false> = [
    {
      key: 'span_operation',
      name: 'Operation',
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'description',
      name: description,
      width: COL_WIDTH_UNDEFINED,
    },
    moduleName !== ModuleName.ALL && {
      key: 'domain',
      name: domain,
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'throughput_trend',
      name: 'Throughput',
      width: 175,
    },
    {
      key: 'p50_trend',
      name: 'Duration (p50)',
      width: 175,
    },
    {
      key: 'app_impact',
      name: 'App Impact',
      width: COL_WIDTH_UNDEFINED,
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
