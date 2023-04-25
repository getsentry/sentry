import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import moment from 'moment';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
} from 'sentry/components/gridEditable';
import {Series} from 'sentry/types/echarts';
import Sparkline from 'sentry/views/starfish/components/sparkline';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';

import {getHostListQuery} from './queries';

export const HOST = 'http://localhost:8080';

type Props = {
  location: Location;
};

type HostTableRow = {
  duration: Series;
  failure_rate: Series;
  host: string;
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
    width: 320,
  },
  {
    key: 'failure_rate',
    name: 'Failure Rate',
    width: 320,
  },
];

export default function HostTable({location}: Props) {
  const query = getHostListQuery();

  const {isLoading: areHostsLoading, data: hostsData} = useQuery({
    queryKey: ['hosts'],
    queryFn: () => fetch(`${HOST}/?query=${query}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const dataByHost = groupBy(hostsData, 'domain');
  const hosts = Object.keys(dataByHost);

  const startDate = moment(orderBy(hostsData, 'interval', 'asc')[0]?.interval);
  const endDate = moment(orderBy(hostsData, 'interval', 'desc')[0]?.interval);

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

      return {
        host,
        duration: durationSeries,
        failure_rate: failureRateSeries,
      };
    })
    .filter(row => {
      return row.duration.data.length > 0;
    });

  return (
    <GridEditable
      isLoading={areHostsLoading}
      data={tableData}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell,
        renderBodyCell: (column: GridColumnHeader, row: HostTableRow) =>
          renderBodyCell(column, row),
      }}
      location={location}
    />
  );
}

function renderHeadCell(column: GridColumnHeader): React.ReactNode {
  return column.name;
}

function renderBodyCell(column: GridColumnHeader, row: HostTableRow): React.ReactNode {
  if (column.key === 'host') {
    return <span>{row[column.key]}</span>;
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

  return row[column.key];
}
