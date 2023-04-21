import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';

const HOST = 'http://localhost:8080';

type Props = {
  location: Location;
};

export default function CacheModuleView({}: Props) {
  const GRAPH_QUERY = `
  select action,
       count() as count,
       toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  from default.spans_experimental_starfish
  where module = 'cache'
 group by interval, action
  order by interval, action
  `;
  const TOTALS_QUERY = `
  select action,
       sum(exclusive_time) as count,
       toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  from default.spans_experimental_starfish
  where module = 'cache'
 group by interval,
          action
  order by interval, action
  `;

  const {isLoading: isGraphLoading, data: graphData} = useQuery({
    queryKey: ['graph'],
    queryFn: () => fetch(`${HOST}/?query=${GRAPH_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const {isLoading: isTopGraphLoading, data: totalsQueryGraphData} = useQuery({
    queryKey: ['topGraph'],
    queryFn: () => fetch(`${HOST}/?query=${TOTALS_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const seriesByOperation: {[action: string]: Series} = {};
  graphData.forEach(datum => {
    seriesByOperation[datum.action] = {
      seriesName: datum.action,
      data: [],
    };
  });

  graphData.forEach(datum => {
    seriesByOperation[datum.action].data.push({
      value: datum.count,
      name: datum.interval,
    });
  });

  const data = Object.values(seriesByOperation);

  const seriesByOperation2: {[action: string]: Series} = {};
  totalsQueryGraphData.forEach(datum => {
    seriesByOperation2[datum.action] = {
      seriesName: datum.action,
      data: [],
    };
  });

  totalsQueryGraphData.forEach(datum => {
    seriesByOperation2[datum.action].data.push({
      value: datum.count,
      name: datum.interval,
    });
  });

  const data2 = Object.values(seriesByOperation2);

  return (
    <Fragment>
      <ChartPanel title={t('Time Spent Per Operation')}>
        <Chart
          statsPeriod="24h"
          height={180}
          data={data2}
          start=""
          end=""
          loading={isTopGraphLoading}
          utc={false}
          grid={{
            left: '0',
            right: '0',
            top: '16px',
            bottom: '8px',
          }}
          disableMultiAxis
          definedAxisTicks={4}
          isLineChart
        />
      </ChartPanel>
      <ChartPanel title={t('Throughput')}>
        <Chart
          statsPeriod="24h"
          height={180}
          data={data}
          start=""
          end=""
          loading={isGraphLoading}
          utc={false}
          grid={{
            left: '0',
            right: '0',
            top: '16px',
            bottom: '8px',
          }}
          disableMultiAxis
          definedAxisTicks={4}
          isLineChart
        />
      </ChartPanel>
    </Fragment>
  );
}
