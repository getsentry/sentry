import {Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import Link from 'sentry/components/links/link';
import {Series} from 'sentry/types/echarts';
import {formatPercentage} from 'sentry/utils/formatters';
import {useLocation} from 'sentry/utils/useLocation';
import {TableColumnSort} from 'sentry/views/discover/table/types';
import {P95_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import {FormattedCode} from 'sentry/views/starfish/components/formattedCode';
import Sparkline, {
  generateHorizontalLine,
} from 'sentry/views/starfish/components/sparkline';
import {
  ApplicationMetrics,
  useApplicationMetrics,
} from 'sentry/views/starfish/queries/useApplicationMetrics';
import {ModuleName} from 'sentry/views/starfish/types';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {
  DurationTrendCell,
  TimeSpentCell,
} from 'sentry/views/starfish/views/spanSummaryPage/spanBaselineTable';

type Props = {
  isLoading: boolean;
  moduleName: ModuleName;
  onSetOrderBy: (orderBy: string) => void;
  orderBy: string;
  spansData: SpanDataRow[];
  spansTrendsData: SpanTrendDataRow[];
  columnOrder?: TableColumnHeader[];
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

export type Keys =
  | 'description'
  | 'p50_trend'
  | 'p95_trend'
  | 'throughput_trend'
  | 'span_operation'
  | 'domain'
  | 'epm()'
  | 'p95(span.self_time)'
  | 'timeSpent'
  | 'total_exclusive_time';
export type TableColumnHeader = GridColumnHeader<Keys>;

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
      timeSpent: formatPercentage(
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
        orderBy ? [] : [{key: orderBy, order: 'desc'} as TableColumnSort<Keys>]
      }
      grid={{
        renderHeadCell: getRenderHeadCell(orderBy, onSetOrderBy),
        renderBodyCell: (column, row) =>
          renderBodyCell(column, row, theme, applicationMetrics),
      }}
      location={location}
    />
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
  theme: Theme,
  applicationMetrics: ApplicationMetrics
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

  if (column.key === 'p95_trend' && row[column.key]) {
    return (
      <DurationTrendCell
        color={P95_COLOR}
        duration={row.p95}
        durationSeries={row[column.key]}
      />
    );
  }

  if (column.key === 'description') {
    const description = row.description;
    return (
      <OverflowEllipsisTextContainer>
        <Link to={`/starfish/span/${row.group_id}`}>
          {row.span_operation === 'db' ? (
            <StyledFormattedCode>{description}</StyledFormattedCode>
          ) : (
            description || '<null>'
          )}
        </Link>
      </OverflowEllipsisTextContainer>
    );
  }

  if (column.key.toString().match(/^p\d\d/) || column.key === 'total_exclusive_time') {
    return <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />;
  }

  if (column.key === 'timeSpent') {
    return (
      <TimeSpentCell
        formattedTimeSpent={row[column.key]}
        totalAppTime={applicationMetrics['sum(span.duration)']}
        totalSpanTime={row.total_exclusive_time}
      />
    );
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

function getColumns(moduleName: ModuleName): TableColumnHeader[] {
  const description = getDescriptionHeader(moduleName);

  const domain = getDomainHeader(moduleName);

  const order: TableColumnHeader[] = [
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
    ...(moduleName !== ModuleName.ALL
      ? [
          {
            key: 'domain',
            name: domain,
            width: COL_WIDTH_UNDEFINED,
          } as TableColumnHeader,
        ]
      : []),
    {
      key: 'throughput_trend',
      name: 'Throughput',
      width: 175,
    },
    {
      key: 'p95_trend',
      name: DataTitles.p95,
      width: 175,
    },
    {
      key: 'timeSpent',
      name: DataTitles.timeSpent,
      width: COL_WIDTH_UNDEFINED,
    },
  ];

  return order;
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
