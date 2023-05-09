import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {getSpanDurationSeries} from 'sentry/views/starfish/views/webServiceView/queries';

export function ModuleBreakdownChart() {
  const pageFilter = usePageFilters();

  const {isLoading, data} = useQuery({
    queryKey: ['spanDurationSeries'],
    queryFn: () =>
      fetch(`${HOST}/?query=${getSpanDurationSeries('')}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  console.dir(data);

  const seriesGroupedBySpan: {[span: string]: Series[]} = {};

  data.forEach(({span, interval, p75, count}) => {
    const seriesGroup = seriesGroupedBySpan[span];
    if (seriesGroup) {
      seriesGroupedBySpan[span][0].data.push({name: interval, value: p75});
      seriesGroupedBySpan[span][1].data.push({name: interval, value: count});
    } else {
      seriesGroupedBySpan[span] = [
        {seriesName: 'p75', data: [{name: interval, value: p75}]},
        {seriesName: 'Throughput', data: [{name: interval, value: count}]},
      ];
    }
  });

  console.dir(seriesGroupedBySpan);

  return (
    <ChartPanel title={t('p75 of database spans')}>
      {/* <Chart
        statsPeriod="24h"
        height={180}
        data={data}
        start=""
        end=""
        loading={isDbDurationLoading}
        utc={false}
        stacked
        grid={{
          left: '0',
          right: '12px',
          top: '16px',
          bottom: '8px',
        }}
        definedAxisTicks={4}
        chartColors={['#444674', '#7a5088', '#b85586']}
        throughput={dbThroughputData}
      /> */}
    </ChartPanel>
  );
}
