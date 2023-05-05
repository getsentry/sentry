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
  getEndpointListEventView,
  getEndpointListQuery,
  getEndpointsThroughputQuery,
} from './queries';

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
    key: 'p50(span.self_time)',
    name: 'p50',
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

  const {isLoading: isEndpointsThroughputLoading, data: endpointsThroughputData} =
    useQuery({
      queryKey: ['endpointsThroughput', filterOptions],
      queryFn: () =>
        fetch(`${HOST}/?query=${getEndpointsThroughputQuery(filterOptions)}`).then(res =>
          res.json()
        ),
      retry: false,
      initialData: [],
    });

  const throughputGroupedByURL = {};
  endpointsThroughputData.forEach(({description, interval, count}) => {
    if (description in throughputGroupedByURL) {
      throughputGroupedByURL[description].push({name: interval, value: count});
    } else {
      throughputGroupedByURL[description] = [{name: interval, value: count}];
    }
  });

  const combinedEndpointData = endpointsData.map(data => {
    const url = data.description;

    const throughputSeries: Series = {
      seriesName: 'throughput',
      data: throughputGroupedByURL[url],
    };

    const zeroFilled = zeroFillSeries(throughputSeries, moment.duration(12, 'hours'));
    return {...data, throughput: zeroFilled};
  });

  return (
    <GridEditable
      isLoading={areEndpointsLoading || isEndpointsThroughputLoading}
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
  if (column.key === 'throughput') {
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
      <Sparkline
        color={CHART_PALETTE[3][0]}
        series={row[column.key]}
        width={column.width ? column.width - column.width / 5 : undefined}
      />
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
