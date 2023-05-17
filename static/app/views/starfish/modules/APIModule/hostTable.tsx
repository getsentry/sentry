import {ReactNode} from 'react';
import {Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import moment from 'moment';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {getDuration} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {INTERNAL_API_REGEX} from 'sentry/views/starfish/modules/APIModule/constants';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

import {getEndpointDomainsQuery, getHostListQuery} from './queries';

type Props = {
  location: Location;
  setDomainFilter: (domain: string) => void;
};

type HostTableRow = {
  duration: Series;
  failure_rate: Series;
  host: string;
  max: number;
  p50: number;
  p95: number;
  p99: number;
};

const COLUMN_ORDER = [
  {
    key: 'host',
    name: 'Host',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'duration',
    name: 'Response Time',
    width: 220,
  },
  {
    key: 'failure_rate',
    name: 'Failure Rate',
    width: 220,
  },
  {
    key: 'p50',
    name: 'P50',
    width: 200,
  },
  {
    key: 'p95',
    name: 'P95',
    width: 200,
  },
  {
    key: 'total_exclusive_time',
    name: 'Total Exclusive Time',
    width: 200,
  },
];

export default function HostTable({location, setDomainFilter}: Props) {
  const pageFilter = usePageFilters();
  const theme = useTheme();
  const queryString = getHostListQuery({
    datetime: pageFilter.selection.datetime,
  });
  const aggregateQueryString = getEndpointDomainsQuery({
    datetime: pageFilter.selection.datetime,
  });

  const {isLoading: areHostsLoading, data: hostsData} = useQuery({
    queryKey: ['query', pageFilter.selection.datetime],
    queryFn: () => fetch(`${HOST}/?query=${queryString}`).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
  });

  const {isLoading: areHostAggregatesLoading, data: aggregateHostsData} = useQuery({
    queryKey: ['aggregateQuery', pageFilter.selection.datetime],
    queryFn: () =>
      fetch(`${HOST}/?query=${aggregateQueryString}`).then(res => res.json()),
    retry: false,
    refetchOnWindowFocus: false,
    initialData: [],
  });

  const dataByHost = groupBy(hostsData, 'domain');

  // Filter out localhost and any IP addresses (probably an internal service)
  const hosts = Object.keys(dataByHost).filter(host => !host.match(INTERNAL_API_REGEX));

  const startDate = moment(orderBy(hostsData, 'interval', 'asc')[0]?.interval);
  const endDate = moment(orderBy(hostsData, 'interval', 'desc')[0]?.interval);

  let totalTotalExclusiveTime = 0;
  let totalP50 = 0;
  let totalP95 = 0;

  const tableData: HostTableRow[] = hosts
    .map(host => {
      const durationSeries: Series = zeroFillSeries(
        {
          seriesName: host,
          data: dataByHost[host].map(datum => ({
            name: datum.interval,
            value: datum.p99,
          })),
        },
        moment.duration(12, 'hours'),
        startDate,
        endDate
      );

      const failureRateSeries: Series = zeroFillSeries(
        {
          seriesName: host,
          data: dataByHost[host].map(datum => ({
            name: datum.interval,
            value: datum.failure_rate,
          })),
        },
        moment.duration(12, 'hours'),
        startDate,
        endDate
      );

      const {
        'p50(span.self_time)': p50,
        'p99(span.self_time)': p99,
        'p95(span.self_time)': p95,
        'p100(span.self_time)': max,
        'sum(span.self_time)': total_exclusive_time,
      } = aggregateHostsData?.find(aggregate => aggregate.domain === host) ?? {};

      totalTotalExclusiveTime += total_exclusive_time;
      totalP50 += p50;
      totalP95 += p95;

      return {
        host,
        duration: durationSeries,
        failure_rate: failureRateSeries,
        p50,
        p99,
        p95,
        max,
        total_exclusive_time,
      };
    })
    .filter(row => {
      return row.duration.data.length > 0;
    })
    .sort((a, b) => b.total_exclusive_time - a.total_exclusive_time);

  return (
    <GridEditable
      isLoading={areHostsLoading || areHostAggregatesLoading}
      data={tableData}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell: (column: GridColumnHeader, row: HostTableRow) =>
          renderBodyCell({
            column,
            row,
            theme,
            totalTotalExclusiveTime,
            totalP50,
            totalP95,
            setDomainFilter,
          }),
      }}
      location={location}
      height={400}
      scrollable
      stickyHeader
    />
  );
}

function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  return column.name;
}

function renderBodyCell({
  column,
  row,
  theme,
  totalTotalExclusiveTime,
  totalP50,
  totalP95,
  setDomainFilter,
}: {
  column: GridColumnHeader;
  row: HostTableRow;
  setDomainFilter: (domain: string) => void;
  theme: Theme;
  totalP50: number;
  totalP95: number;
  totalTotalExclusiveTime: number;
}): React.ReactNode {
  if (column.key === 'host') {
    return <a onClick={() => setDomainFilter(row.host)}>{row[column.key]}</a>;
  }

  if (column.key === 'duration') {
    const series: Series = row[column.key];
    if (series) {
      return <Sparkline color="rgb(242, 183, 18)" series={series} />;
    }

    return 'Loading';
  }

  if (column.key === 'failure_rate') {
    const series: Series = row[column.key];
    if (series) {
      return <Sparkline color="#ef7061" series={series} />;
    }

    return 'Loading';
  }

  if (column.key === 'total_exclusive_time') {
    return (
      <MeterBar
        minWidth={0.1}
        meterItems={['total_exclusive_time']}
        row={row}
        total={totalTotalExclusiveTime}
        color={theme.green300}
      />
    );
  }

  if (column.key === 'p50') {
    return (
      <MeterBar
        minWidth={0.1}
        meterItems={['p50']}
        row={row}
        total={totalP50}
        color={theme.blue300}
      />
    );
  }

  if (column.key === 'p95') {
    return (
      <MeterBar
        minWidth={0.1}
        meterItems={['p95']}
        row={row}
        total={totalP95}
        color={theme.red300}
      />
    );
  }

  return row[column.key];
}

export function MeterBar({
  minWidth,
  meterItems,
  row,
  total,
  color,
  meterText,
}: {
  color: string;
  meterItems: string[];
  minWidth: number;
  row: any;
  total: number;
  meterText?: ReactNode;
}) {
  const widths = [] as number[];
  meterItems.reduce((acc, item, index) => {
    const width = Math.max(
      Math.min(
        (100 * row[item]) / total - acc,
        100 - acc - minWidth * (meterItems.length - index)
      ),
      minWidth
    );

    widths.push(width);
    return acc + width;
  }, 0);
  return (
    <span>
      <MeterText>
        {meterText ?? `${getDuration(row[meterItems[0]] / 1000, 0, true, true)}`}
      </MeterText>
      <MeterContainer width={100}>
        <Meter width={widths[0]} color={color} />
      </MeterContainer>
    </span>
  );
}

const MeterContainer = styled('span')<{width: number}>`
  display: flex;
  width: ${p => p.width}%;
  height: ${space(1)};
  background-color: ${p => p.theme.gray100};
  margin-bottom: 4px;
`;

const Meter = styled('span')<{
  color: string;
  width: number;
}>`
  display: block;
  width: ${p => p.width}%;
  height: 100%;
  background-color: ${p => p.color};
`;
const MeterText = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.gray300};
  white-space: nowrap;
`;
