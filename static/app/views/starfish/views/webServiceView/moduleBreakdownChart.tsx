import isNil from 'lodash/isNil';
import moment from 'moment';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {useQuery} from 'sentry/utils/queryClient';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {
  getOtherSpanDurationSeries,
  getSpanDurationSeries,
  getThroughputByModule,
} from 'sentry/views/starfish/views/webServiceView/queries';

type Props = {
  module: string;
  topSpans: string[];
};

export function ModuleBreakdownChart({module, topSpans}: Props) {
  const topSpansQueryString = topSpans.join(', ');

  const {isLoading, data} = useQuery({
    queryKey: ['topSpanDurationSeries', topSpansQueryString],
    queryFn: () =>
      fetch(`${HOST}/?query=${getSpanDurationSeries(topSpansQueryString)}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
  });

  console.log(getOtherSpanDurationSeries(topSpansQueryString));
  console.dir(data);
  const {isLoading: isOtherSpanDurationDataLoading, data: otherSpanDurationData} =
    useQuery({
      queryKey: ['otherSpanDurationSeries', topSpansQueryString],
      queryFn: () =>
        fetch(`${HOST}/?query=${getOtherSpanDurationSeries(topSpansQueryString)}`).then(
          res => res.json()
        ),
      retry: false,
      initialData: [],
    });

  console.dir(otherSpanDurationData);

  const {data: throughputData} = useQuery({
    queryKey: ['topSpansThroughputData', module],
    queryFn: () =>
      fetch(`${HOST}/?query=${getThroughputByModule(module)}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const seriesBySpan: {[span: string]: Series} = {};
  let start: moment.Moment | undefined = undefined;
  let end: moment.Moment | undefined = undefined;

  data.forEach(({span, interval, p75}) => {
    if (isNil(start) || moment(interval) < start) {
      start = moment(interval);
    }
    if (isNil(end) || moment(interval) > end) {
      end = moment(interval);
    }

    const series = seriesBySpan[span];
    if (series) {
      series.data.push({name: interval, value: p75});
    } else {
      seriesBySpan[span] = {
        seriesName: `p75 — ${span}`,
        data: [{name: interval, value: p75}],
      };
    }
  });

  return (
    <ChartPanel title={t('Top Spans p75 Breakdown')}>
      <Chart
        statsPeriod="24h"
        height={180}
        data={Object.values(seriesBySpan).map(series =>
          zeroFillSeries(series, moment.duration(1, 'days'), start, end)
        )}
        start=""
        end=""
        loading={isLoading}
        utc={false}
        stacked
        grid={{
          left: '0',
          right: '12px',
          top: '16px',
          bottom: '8px',
        }}
        definedAxisTicks={4}
        chartColors={CHART_PALETTE[4]}
        throughput={throughputData}
      />
    </ChartPanel>
  );
}
