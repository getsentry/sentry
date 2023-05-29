import {ReactElement} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import moment from 'moment';

import {DateTimeObject} from 'sentry/components/charts/utils';
import Duration from 'sentry/components/duration';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {Series} from 'sentry/types/echarts';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {useSpansQuery} from 'sentry/views/starfish/utils/useSpansQuery';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {EndpointDataRow} from 'sentry/views/starfish/views/endpointDetails';

import {
  getEndpointAggregatesQuery,
  getEndpointListEventView,
  getEndpointListQuery,
} from '../modules/APIModule/queries';

type Props = {
  filterOptions: {
    action: string;
    datetime: DateTimeObject;
    domain: string;
    transaction: string;
  };
  location: Location;
  onSelect: (row: EndpointDataRow) => void;
  columns?: {
    key: string;
    name: string;
    width: number;
  }[];
};

export type DataRow = {
  count: number;
  description: string;
  domain: string;
  group_id: string;
};

const COLUMN_ORDER = [
  {
    key: 'description',
    name: 'URL',
    width: 600,
  },
  {
    key: 'throughput',
    name: 'throughput',
    width: 200,
  },
  {
    key: 'p50_trend',
    name: 'p50 Trend',
    width: 200,
  },
  {
    key: 'p50(span.self_time)',
    name: 'p50',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'p95(span.self_time)',
    name: 'p95',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count_unique(user)',
    name: 'Users',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'count_unique(transaction)',
    name: 'Transactions',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'sum(span.self_time)',
    name: 'Total Time',
    width: COL_WIDTH_UNDEFINED,
  },
];

export default function EndpointTable({
  location,
  onSelect,
  filterOptions,
  columns,
}: Props) {
  const {isLoading: areEndpointsLoading, data: endpointsData} = useSpansQuery({
    queryString: getEndpointListQuery(filterOptions),
    eventView: getEndpointListEventView(filterOptions),
    initialData: [],
  });

  const {isLoading: areEndpointAggregatesLoading, data: endpointsThroughputData} =
    useQuery({
      queryKey: ['endpointAggregates', filterOptions],
      queryFn: () =>
        fetch(`${HOST}/?query=${getEndpointAggregatesQuery(filterOptions)}`).then(res =>
          res.json()
        ),
      retry: false,
      refetchOnWindowFocus: false,
      initialData: [],
    });

  const aggregatesGroupedByURL = {};
  endpointsThroughputData.forEach(({description, interval, count, p50, p95}) => {
    if (description in aggregatesGroupedByURL) {
      aggregatesGroupedByURL[description].push({name: interval, count, p50, p95});
    } else {
      aggregatesGroupedByURL[description] = [{name: interval, count, p50, p95}];
    }
  });

  const combinedEndpointData = endpointsData.map(data => {
    const url = data.description;

    const throughputSeries: Series = {
      seriesName: 'throughput',
      data: aggregatesGroupedByURL[url]?.map(({name, count}) => ({
        name,
        value: count,
      })),
    };

    const p50Series: Series = {
      seriesName: 'p50 Trend',
      data: aggregatesGroupedByURL[url]?.map(({name, p50}) => ({
        name,
        value: p50,
      })),
    };

    const p95Series: Series = {
      seriesName: 'p95 Trend',
      data: aggregatesGroupedByURL[url]?.map(({name, p95}) => ({
        name,
        value: p95,
      })),
    };

    const zeroFilledThroughput = zeroFillSeries(
      throughputSeries,
      moment.duration(12, 'hours')
    );
    const zeroFilledP50 = zeroFillSeries(p50Series, moment.duration(12, 'hours'));
    const zeroFilledP95 = zeroFillSeries(p95Series, moment.duration(12, 'hours'));
    return {
      ...data,
      throughput: zeroFilledThroughput,
      p50_trend: zeroFilledP50,
      p95_trend: zeroFilledP95,
    };
  });

  return (
    <GridEditable
      isLoading={areEndpointsLoading || areEndpointAggregatesLoading}
      data={combinedEndpointData}
      columnOrder={columns ?? COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell: (column: GridColumnHeader, row: EndpointDataRow) =>
          renderBodyCell(column, row, onSelect),
      }}
      location={location}
    />
  );
}

export function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  if (column.key === 'throughput' || column.key === 'p50_trend') {
    return (
      <TextAlignLeft>
        <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
      </TextAlignLeft>
    );
  }

  // TODO: come up with a better way to identify number columns to align to the right
  if (
    column.key.toString().match(/^p\d\d/) ||
    !['description', 'transaction'].includes(column.key.toString())
  ) {
    return (
      <TextAlignRight>
        <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
      </TextAlignRight>
    );
  }
  return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
}

export function renderBodyCell(
  column: GridColumnHeader,
  row: EndpointDataRow,
  onSelect?: (row: EndpointDataRow) => void
): React.ReactNode {
  if (column.key === 'description' && onSelect) {
    return (
      <OverflowEllipsisTextContainer>
        <Link onClick={() => onSelect(row)} to="">
          {row[column.key]}
        </Link>
      </OverflowEllipsisTextContainer>
    );
  }

  if (column.key === 'throughput') {
    return (
      <GraphRow>
        <span>{row.count.toFixed(2)}</span>
        <Sparkline
          color={CHART_PALETTE[3][0]}
          series={row[column.key]}
          width={column.width ? column.width - column.width / 5 : undefined}
        />
      </GraphRow>
    );
  }

  if (column.key === 'p50_trend') {
    return (
      <GraphRow>
        <span>{row['p50(span.self_time)'].toFixed(2)}</span>
        <Graphline>
          <Sparkline
            color={CHART_PALETTE[3][1]}
            series={row[column.key]}
            width={column.width ? column.width - column.width / 5 - 50 : undefined}
          />
        </Graphline>
      </GraphRow>
    );
  }

  if (column.key === 'p95_trend') {
    return (
      <GraphRow>
        <span>{row['p95(span.self_time)'].toFixed(2)}</span>
        <Graphline>
          <Sparkline
            color={CHART_PALETTE[3][2]}
            series={row[column.key]}
            width={column.width ? column.width - column.width / 5 - 50 : undefined}
          />
        </Graphline>
      </GraphRow>
    );
  }

  // TODO: come up with a better way to identify number columns to align to the right
  let node: ReactElement | null = null;
  if (column.key.toString().match(/^p\d\d/) || column.key === 'sum(span.self_time)') {
    node = <Duration seconds={row[column.key] / 1000} fixedDigits={2} abbreviation />;
  } else if (!['description', 'transaction'].includes(column.key.toString())) {
    node = (
      <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>
    );
  } else {
    node = (
      <OverflowEllipsisTextContainer>{row[column.key]}</OverflowEllipsisTextContainer>
    );
  }

  const isNumericColumn =
    column.key.toString().match(/^p\d\d/) || column.key.toString().match(/^.*\(.*\)/);

  if (isNumericColumn) {
    return <TextAlignRight>{node}</TextAlignRight>;
  }

  return <TextAlignLeft>{node}</TextAlignLeft>;
}

export const OverflowEllipsisTextContainer = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

export const TextAlignRight = styled('span')`
  text-align: right;
  width: 100%;
`;

export const TextAlignLeft = styled('span')`
  text-align: left;
  width: 100%;
`;

const Graphline = styled('div')`
  margin-left: auto;
`;
const GraphRow = styled('div')`
  display: inline-flex;
`;
