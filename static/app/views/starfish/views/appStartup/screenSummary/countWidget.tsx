import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {t} from 'sentry/locale';
import {MultiSeriesEventsStats} from 'sentry/types';
import {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import Chart from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {
  COLD_START_COLOR,
  WARM_START_COLOR,
} from 'sentry/views/starfish/views/appStartup/appStartBreakdown';
import {OUTPUT_TYPE, YAxis} from 'sentry/views/starfish/views/screens';

const SPAN_OP_TO_STRING = {
  'app.start.cold': t('Cold Start'),
  'app.start.warm': t('Warm Start'),
};

function transformData(data?: MultiSeriesEventsStats) {
  const transformedSeries: {[yAxisName: string]: Series} = {};
  if (defined(data)) {
    Object.keys(data).forEach(yAxis => {
      transformedSeries[yAxis] = {
        seriesName: yAxis,
        data:
          data[yAxis]?.data.map(datum => {
            return {
              name: datum[0] * 1000,
              value: datum[1][0].count,
            } as SeriesDataUnit;
          }) ?? [],
      };
    });
  }
  return transformedSeries;
}

interface Props {
  additionalFilters?: string[];
}

function CountWidget({additionalFilters}: Props) {
  const pageFilter = usePageFilters();
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch([
    'span.op:[app.start.warm,app.start.cold]',
    ...(additionalFilters ?? []),
  ]);
  const queryString = `${appendReleaseFilters(
    query,
    primaryRelease,
    secondaryRelease
  )} span.description:["Cold Start","Warm Start"]`;

  const {
    data: series,
    isLoading: isSeriesLoading,
    isError,
  } = useEventsStatsQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        topEvents: '2',
        fields: ['span.op', 'count()'],
        yAxis: ['count()'],
        query: queryString,
        dataset: DiscoverDatasets.SPANS_METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      pageFilter.selection
    ),
    enabled: !isReleasesLoading,
    referrer: 'api.starfish.mobile-startup-series',
    initialData: {},
  });

  if (isSeriesLoading) {
    return <LoadingContainer isLoading />;
  }

  const transformedSeries = transformData(series);

  return (
    <MiniChartPanel title={t('Count')}>
      <Chart
        chartColors={[COLD_START_COLOR, WARM_START_COLOR]}
        data={Object.values(transformedSeries)}
        height={90}
        loading={isSeriesLoading}
        grid={{
          left: '0',
          right: '0',
          top: '8px',
          bottom: '0',
        }}
        showLegend
        definedAxisTicks={2}
        isLineChart
        aggregateOutputFormat={OUTPUT_TYPE[YAxis.COUNT]}
        tooltipFormatterOptions={{
          valueFormatter: value =>
            tooltipFormatterUsingAggregateOutputType(value, OUTPUT_TYPE[YAxis.COUNT]),
          nameFormatter: value => SPAN_OP_TO_STRING[value],
        }}
        legendFormatter={value => SPAN_OP_TO_STRING[value]}
        errored={isError}
      />
    </MiniChartPanel>
  );
}

export default CountWidget;
