import {Fragment} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Location} from 'history';

import {Series} from 'sentry/types/echarts';
import Chart from 'sentry/views/starfish/components/chart';

const HOST = 'http://localhost:8080';

type Props = {
  location: Location;
};

export default function APIModuleView({}: Props) {
  const GRAPH_QUERY = `
  select operation,
       count() as count,
       toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  from default.spans_experimental_starfish
  where startsWith(span_operation, 'db')
    and span_operation != 'db.redis'
 group by interval,
          operation
  order by interval, operation
  `;
  const TOP_QUERY = `
  select quantile(0.5)(exclusive_time) as p50, description,
       toStartOfInterval(start_timestamp, INTERVAL 1 DAY) as interval
  from default.spans_experimental_starfish
 where description in (
        select description
          from default.spans_experimental_starfish
         where startsWith(span_operation, 'db')
           and span_operation != 'db.redis'
         group by description
         order by -pow(10, floor(log10(count()))), -quantile(0.5)(exclusive_time)
         limit 5
       )
 group by interval,
          description
 order by interval,
          description
  `;

  const {isLoading: isGraphLoading, data: graphData} = useQuery({
    queryKey: ['graph'],
    queryFn: () => fetch(`${HOST}/?query=${GRAPH_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });
  const {isLoading: isTopGraphLoading, data: topGraphData} = useQuery({
    queryKey: ['topGraph'],
    queryFn: () => fetch(`${HOST}/?query=${TOP_QUERY}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const seriesByOperation: {[operation: string]: Series} = {};
  graphData.forEach(datum => {
    seriesByOperation[datum.operation] = {
      seriesName: datum.operation,
      data: [],
    };
  });

  graphData.forEach(datum => {
    seriesByOperation[datum.operation].data.push({
      value: datum.count,
      name: datum.interval,
    });
  });

  const data = Object.values(seriesByOperation);

  const seriesByQuery: {[operation: string]: Series} = {};
  topGraphData.forEach(datum => {
    seriesByQuery[datum.description] = {
      seriesName: datum.description.substring(0, 50),
      data: [],
    };
  });

  topGraphData.forEach(datum => {
    seriesByQuery[datum.description].data.push({
      value: datum.p50,
      name: datum.interval,
    });
  });

  const topData = Object.values(seriesByQuery);

  return (
    <Fragment>
      Slowest Queries
      <Chart
        statsPeriod="24h"
        height={180}
        data={topData}
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
      Throughput
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
    </Fragment>
  );
}
