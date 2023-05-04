import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import moment from 'moment';

import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TableColumnSort} from 'sentry/views/discover/table/types';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

import {getSpanListQuery, getSpansTrendsQuery} from './queries';

type Props = {
  location: Location;
  orderBy?: string;
};

type SpanDataRow = {
  description: string;
  group_id: string;
  span_operation: string;
};

type SpanTrendDataRow = {
  group_id: string;
  interval: string;
  p95: string;
  span_operation: string;
};

const LIMIT = 10;

const COLUMN_ORDER = [
  {
    key: 'group_id',
    name: 'Group',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span_operation',
    name: 'Operation',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'description',
    name: 'Description',
    width: COL_WIDTH_UNDEFINED,
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

type State = {
  orderBy?: string;
};

export default function SpansTable({location}: Props) {
  const pageFilter = usePageFilters();
  const [state, setState] = useState<State>({});
  const {orderBy} = state;
  const {isLoading, data} = useQuery<{
    spansData?: SpanDataRow[];
    spansTrendsData?: SpanTrendDataRow[];
  }>({
    queryKey: ['spans', pageFilter.selection.datetime, orderBy],
    queryFn: async () => {
      const spansData = await (
        await fetch(
          `${HOST}/?query=${getSpanListQuery({
            datetime: pageFilter.selection.datetime,
            orderBy,
            limit: LIMIT,
          })}`
        )
      ).json();
      const group_ids = spansData.map(({group_id}) => group_id);
      const spansTrendsData =
        group_ids.length > 0
          ? await (
              await fetch(
                `${HOST}/?query=${getSpansTrendsQuery({
                  datetime: pageFilter.selection.datetime,
                  group_ids,
                })}`
              )
            ).json()
          : undefined;
      return new Promise(resolve =>
        resolve({spansData, spansTrendsData} as {
          spansData?: SpanDataRow[];
          spansTrendsData?: SpanTrendDataRow[];
        })
      );
    },
    retry: false,
    initialData: {},
  });

  const spansTrendsGrouped = {};
  const {spansData, spansTrendsData} = data;

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
      data={combinedSpansData as SpanDataRow[]}
      columnOrder={COLUMN_ORDER}
      columnSortBy={
        orderBy ? [] : [{key: orderBy, order: 'desc'} as TableColumnSort<string>]
      }
      grid={{
        renderHeadCell: getRenderHeadCell({state, setState}),
        renderBodyCell,
      }}
      location={location}
    />
  );
}

function getRenderHeadCell({
  state,
  setState,
}: {
  setState: (state: State) => void;
  state: State;
}) {
  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    return (
      <SortLink
        align="left"
        canSort={column.key !== 'p95_trend'}
        direction={state.orderBy === column.key ? 'desc' : undefined}
        onClick={() => {
          setState({orderBy: `${column.key}`});
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

function renderBodyCell(column: GridColumnHeader, row: SpanDataRow): React.ReactNode {
  if (column.key === 'p95_trend') {
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
