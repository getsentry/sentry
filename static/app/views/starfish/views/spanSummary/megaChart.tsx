import {useTheme} from '@emotion/react';
import {useQuery} from '@tanstack/react-query';
import moment from 'moment';

import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import {
  getEndpointDetailSeriesQuery,
  getEndpointDetailTableQuery,
} from 'sentry/views/starfish/modules/APIModule/queries';
import {HOST} from 'sentry/views/starfish/utils/constants';
import {PERIOD_REGEX} from 'sentry/views/starfish/utils/dates';
import {zeroFillSeries} from 'sentry/views/starfish/utils/zeroFillSeries';
import {
  getSidebarAggregatesQuery,
  getSidebarSeriesQuery,
} from 'sentry/views/starfish/views/spanSummary/queries';

export default function MegaChart({
  spanGroupOperation,
  groupId,
  description,
  transactionName,
  sampledSpanData,
}) {
  const theme = useTheme();
  const pageFilter = usePageFilters();
  const {getSeriesQuery} = getQueries(spanGroupOperation);
  const module = spanGroupOperation;
  const seriesQuery = getSeriesQuery({
    description,
    transactionName,
    datetime: pageFilter.selection.datetime,
    groupId,
    module,
    interval: 12,
  });

  // Also a metrics span query that fetches series data
  const {isLoading: isLoadingSeriesData, data: seriesData} = useQuery({
    queryKey: [seriesQuery],
    queryFn: () => fetch(`${HOST}/?query=${seriesQuery}`).then(res => res.json()),
    retry: false,
    initialData: [],
  });

  const [_, num, unit] = pageFilter.selection.datetime.period?.match(PERIOD_REGEX) ?? [];
  const startTime =
    num && unit
      ? moment().subtract(num, unit as 'h' | 'd')
      : moment(pageFilter.selection.datetime.start);
  const endTime = moment(pageFilter.selection.datetime.end ?? undefined);

  const [p50Series, p95Series, _countSeries, _errorCountSeries, _errorRateSeries] =
    queryDataToChartData(seriesData).map(series =>
      zeroFillSeries(series, moment.duration(12, 'hours'), startTime, endTime)
    );

  const chartColors = theme.charts.getColorPalette(1);
  const sampledSpanDataSeries = sampledSpanData.map(({timestamp, spanDuration}) => ({
    name: timestamp,
    value: spanDuration,
  }));

  return (
    <div>
      <h3>{t('Span Duration')}</h3>
      <ChartWrapper
        series={p50Series && p95Series ? [p50Series, p95Series] : []}
        isLoading={isLoadingSeriesData}
        chartColor={chartColors}
        sampledSpanDataSeries={sampledSpanDataSeries}
      />
    </div>
  );
}

function ChartWrapper(props) {
  return (
    <Chart
      statsPeriod="24h"
      height={400}
      data={props.series}
      start=""
      end=""
      loading={props.isLoading}
      utc={false}
      stacked
      isLineChart
      disableXAxis
      hideYAxisSplitLine
      chartColors={props.chartColor}
      grid={{
        left: '0',
        right: '0',
        top: '8px',
        bottom: '16px',
      }}
      scatterPlot={
        props.sampledSpanDataSeries.length
          ? [{data: props.sampledSpanDataSeries, seriesName: 'Sampled Span Duration'}]
          : undefined
      }
    />
  );
}

function queryDataToChartData(data: any) {
  const series = [] as any[];
  if (data.length > 0) {
    Object.keys(data[0])
      .filter(key => key !== 'interval')
      .forEach(key => {
        series.push({seriesName: `${key}()`, data: [] as any[]});
      });
  }
  data.forEach(point => {
    Object.keys(point).forEach(key => {
      if (key !== 'interval') {
        series
          .find(serie => serie.seriesName === `${key}()`)
          ?.data.push({
            name: point.interval,
            value: point[key],
          });
      }
    });
  });
  return series;
}

function getQueries(spanGroupOperation: string) {
  switch (spanGroupOperation) {
    case 'db':
    case 'cache':
      return {
        getSeriesQuery: getSidebarSeriesQuery,
        getAggregatesQuery: getSidebarAggregatesQuery,
      };
    case 'http.client':
      return {
        getSeriesQuery: getEndpointDetailSeriesQuery,
        getAggregatesQuery: getEndpointDetailTableQuery,
      };
    default: // TODO: Need a cleaner default case, but we should never end up here anyways
      return {getSeriesQuery: () => '', getAggregatesQuery: () => ''};
  }
}
