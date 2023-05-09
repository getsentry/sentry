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
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

import type {Cluster} from './clusters';

type Props = {
  clusters: Cluster[];
  isLoading: boolean;
  location: Location;
  onSetOrderBy: (orderBy: string) => void;
  orderBy: string;
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
  percentile: string;
  span_operation: string;
};

export default function SpansTable({
  location,
  spansData,
  orderBy,
  onSetOrderBy,
  clusters,
  spansTrendsData,
  isLoading,
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
      columnOrder={getColumns(clusters)}
      columnSortBy={
        orderBy ? [] : [{key: orderBy, order: 'desc'} as TableColumnSort<string>]
      }
      grid={{
        renderHeadCell: getRenderHeadCell(orderBy, onSetOrderBy),
        renderBodyCell,
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

function renderBodyCell(column: GridColumnHeader, row: SpanDataRow): React.ReactNode {
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
    return (
      <Link to={`/starfish/span/${encodeURIComponent(row.group_id)}`}>
        {row.description}
      </Link>
    );
  }

  if (column.key.toString().match(/^p\d\d/) || column.key === 'total_exclusive_time') {
    return <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />;
  }

  return row[column.key];
}

function getColumns(clusters: Cluster[]): GridColumnOrder[] {
  const secondCluster = clusters.at(1);
  const description =
    clusters.findLast(cluster => Boolean(cluster.description_label))?.description_label ||
    'Description';

  const domain =
    clusters.findLast(cluster => Boolean(cluster.domain_label))?.domain_label || 'Domain';

  const order: Array<GridColumnOrder | false> = [
    !secondCluster && {
      key: 'span_operation',
      name: 'Operation',
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'description',
      name: description,
      width: COL_WIDTH_UNDEFINED,
    },
    !!secondCluster && {
      key: 'domain',
      name: domain,
      width: COL_WIDTH_UNDEFINED,
    },
    {
      key: 'total_exclusive_time',
      name: 'Exclusive Time',
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
