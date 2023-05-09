import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
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

  // const series: {[module: string]: Series} = {};
  // if (!isDbDurationLoading) {
  //   series.database = {
  //     seriesName: `${'database'}`,
  //     data: [],
  //   };

  //   dbDurationData.forEach(value => {
  //     series.database.data.push({value: value.p75, name: value.interval});
  //   });
  // }

  // // TODO: Add to a util instead, copied from APIModuleView
  // const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  // const start =
  //   num && unit
  //     ? moment().subtract(num, unit as 'h' | 'd')
  //     : moment(pageFilter.selection.datetime.start);
  // const end = moment(pageFilter.selection.datetime.end ?? undefined);

  // const data = Object.values(series).map(s =>
  //   zeroFillSeries(s, moment.duration(1, 'day'), start, end)
  // );

  // const button = <ModuleLinkButton type={ModuleButtonType.DB} />;

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
