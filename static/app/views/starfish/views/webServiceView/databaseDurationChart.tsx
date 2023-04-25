import moment from 'moment';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {PERIOD_REGEX} from 'sentry/views/starfish/modules/APIModule/queries';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {
  ModuleButtonType,
  ModuleLinkButton,
} from 'sentry/views/starfish/views/webServiceView/moduleLinkButton';
import {DB_TIME_SPENT} from 'sentry/views/starfish/views/webServiceView/queries';

const HOST = 'http://localhost:8080';

export function DatabaseDurationChart() {
  const pageFilter = usePageFilters();

  const {isLoading: isDbDurationLoading, data: dbDurationData} = useQuery({
    queryKey: ['databaseDuration'],
    queryFn: () => fetch(`${HOST}/?query=${DB_TIME_SPENT}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const series: {[module: string]: Series} = {};
  if (!isDbDurationLoading) {
    series.database = {
      seriesName: `${'database'}`,
      data: [],
    };

    dbDurationData.forEach(value => {
      series.database.data.push({value: value.p75, name: value.interval});
    });
  }

  // TODO: Add to a util instead, copied from APIModuleView
  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const start =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const end = moment(pageFilter.selection.datetime.end ?? undefined);

  const data = Object.values(series).map(s =>
    zeroFillSeries(s, moment.duration(1, 'day'), start, end)
  );

  const button = <ModuleLinkButton type={ModuleButtonType.DB} />;

  return (
    <ChartPanel title={t('p75 of Time Spent in Database')} button={button}>
      <Chart
        statsPeriod="24h"
        height={180}
        data={data}
        start=""
        end=""
        loading={isDbDurationLoading}
        utc={false}
        grid={{
          left: '0',
          right: '0',
          top: '16px',
          bottom: '8px',
        }}
        disableMultiAxis
        definedAxisTicks={4}
        stacked
        chartColors={['#444674', '#7a5088', '#b85586']}
      />
    </ChartPanel>
  );
}
