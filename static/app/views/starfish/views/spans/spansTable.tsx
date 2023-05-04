import {Location} from 'history';
import moment from 'moment';

import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Series} from 'sentry/types/echarts';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

type Props = {
  isLoading: boolean;
  location: Location;
  spansData: SpanDataRow[];
  spansTrendsData: SpanTrendDataRow[];
};

export type SpanDataRow = {
  description: string;
  group_id: string;
  span_operation: string;
};

export type SpanTrendDataRow = {
  group_id: string;
  interval: string;
  p95: string;
  span_operation: string;
};

export default function SpansTable({
  location,
  spansData,
  spansTrendsData,
  isLoading,
}: Props) {
  const spansTrendsGrouped = {};

  spansTrendsData?.forEach(({group_id, span_operation, interval, p95}) => {
    if (span_operation in spansTrendsGrouped) {
      if (group_id in spansTrendsGrouped[span_operation]) {
        return spansTrendsGrouped[span_operation][group_id].push({
          name: interval,
          value: p95,
        });
      }
      return (spansTrendsGrouped[span_operation][group_id] = [
        {name: interval, value: p95},
      ]);
    }
    return (spansTrendsGrouped[span_operation] = {
      [group_id]: [{name: interval, value: p95}],
    });
  });

  const combinedSpansData = spansData?.map(spanData => {
    const {group_id, span_operation} = spanData;
    if (spansTrendsGrouped[span_operation] === undefined) {
      return spanData;
    }
    const p95_trend: Series = {
      seriesName: 'p95_trend',
      data: spansTrendsGrouped[span_operation][group_id],
    };

    const zeroFilled = zeroFillSeries(p95_trend, moment.duration(12, 'hours'));
    return {...spanData, p95_trend: zeroFilled};
  });

  return (
    <GridEditable
      isLoading={isLoading}
      data={combinedSpansData}
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

function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  return column.name;
}

function renderBodyCell(column: GridColumnHeader, row: SpanDataRow): React.ReactNode {
  if (column.key === 'p95_trend' && row[column.key]) {
    return (
      <Sparkline
        color={CHART_PALETTE[3][0]}
        series={row[column.key]}
        width={column.width ? column.width - column.width / 5 : undefined}
      />
    );
  }

  if (column.key.toString().match(/^p\d\d/) || column.key === 'total_exclusive_time') {
    return <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />;
  }

  return row[column.key];
}

const COLUMN_ORDER = [
  {
    key: 'span_operation',
    name: 'Operation',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'action',
    name: 'Action',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'description',
    name: 'Description',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'total_exclusive_time',
    name: 'Exclusive Time',
    width: 250,
  },
  {
    key: 'p95_trend',
    name: 'p95 Trend',
    width: 250,
  },
  {
    key: 'p50',
    name: 'p50',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p95',
    name: 'p95',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p999',
    name: 'p99.9',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count',
    name: 'Count',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'transaction_count',
    name: 'Transactions',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count_per_transaction',
    name: 'Spans per Transaction',
    width: COL_WIDTH_UNDEFINED,
  },
];
