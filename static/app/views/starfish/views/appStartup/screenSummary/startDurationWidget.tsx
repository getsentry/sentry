import {getInterval} from 'sentry/components/charts/utils';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {t} from 'sentry/locale';
import type {MultiSeriesEventsStats} from 'sentry/types';
import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatVersion} from 'sentry/utils/formatters';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {RELEASE_COMPARISON} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';

const COLD_START_CONDITIONS = ['span.op:app.start.cold', 'span.description:"Cold Start"'];
const WARM_START_CONDITIONS = ['span.op:app.start.warm', 'span.description:"Warm Start"'];

export function transformData(data?: MultiSeriesEventsStats, primaryRelease?: string) {
  const transformedSeries: {[releaseName: string]: Series} = {};
  if (defined(data)) {
    Object.keys(data).forEach(releaseName => {
      transformedSeries[releaseName] = {
        seriesName: releaseName,
        color:
          releaseName === primaryRelease
            ? RELEASE_COMPARISON.PRIMARY_RELEASE_COLOR
            : RELEASE_COMPARISON.SECONDARY_RELEASE_COLOR,
        data:
          data[releaseName]?.data?.map(datum => {
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
  chartHeight: number;
  type: 'cold' | 'warm';
  additionalFilters?: string[];
}

function StartDurationWidget({additionalFilters, chartHeight, type}: Props) {
  const pageFilter = usePageFilters();
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const query = new MutableSearch([
    ...(type === 'cold' ? COLD_START_CONDITIONS : WARM_START_CONDITIONS),
    ...(additionalFilters ?? []),
  ]);
  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const {
    data: series,
    isLoading: isSeriesLoading,
    isError,
  } = useEventsStatsQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        topEvents: '2',
        fields: ['release', 'avg(span.duration)'],
        yAxis: ['avg(span.duration)'],
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

  // The expected response is a multi series response, but if there is no data
  // then we get an object representing a single series with all empty values
  // (i.e without being grouped by release)
  const hasReleaseData = series && !('data' in series);

  // Only transform the data is we know there's at least one release
  const transformedSeries = hasReleaseData
    ? Object.values(transformData(series, primaryRelease)).sort()
    : [];

  return (
    <MiniChartPanel
      title={
        type === 'cold' ? t('Avg. Cold Start Duration') : t('Avg. Warm Start Duration')
      }
    >
      <Chart
        data={transformedSeries}
        height={chartHeight}
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
        aggregateOutputFormat="duration"
        tooltipFormatterOptions={{
          valueFormatter: value =>
            tooltipFormatterUsingAggregateOutputType(value, 'duration'),
          nameFormatter: value => formatVersion(value),
        }}
        legendFormatter={value => formatVersion(value)}
        errored={isError}
      />
    </MiniChartPanel>
  );
}

export default StartDurationWidget;
