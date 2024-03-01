import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MultiSeriesEventsStats} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatVersion} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  PRIMARY_RELEASE_COLOR,
  SECONDARY_RELEASE_COLOR,
} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {useEventsStatsQuery} from 'sentry/views/starfish/utils/useEventsStatsQuery';
import {MAX_CHART_RELEASE_CHARS} from 'sentry/views/starfish/views/appStartup';
import {COLD_START_TYPE} from 'sentry/views/starfish/views/appStartup/screenSummary/startTypeSelector';
import {OUTPUT_TYPE, YAxis} from 'sentry/views/starfish/views/screens';

function transformData(data?: MultiSeriesEventsStats, primaryRelease?: string) {
  const transformedSeries: {[release: string]: Series} = {};

  // Check that 'meta' is not in the data object because that's a sign
  // that we did not get a multi-series response for comparison
  if (defined(data) && !('meta' in data)) {
    Object.keys(data).forEach(release => {
      transformedSeries[release] = {
        seriesName: release,
        data:
          data[release]?.data?.map(datum => {
            return {
              name: datum[0] * 1000,
              value: datum[1][0].count,
            };
          }) ?? [],
        ...(primaryRelease === release
          ? {color: PRIMARY_RELEASE_COLOR}
          : {
              color: SECONDARY_RELEASE_COLOR,
              lineStyle: {type: 'dashed'},
            }),
      };
    });
  }
  return transformedSeries;
}

interface Props {
  chartHeight?: number;
}

export function CountChart({chartHeight}: Props) {
  const location = useLocation();
  const pageFilter = usePageFilters();
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  const appStartType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const query = new MutableSearch([`span.op:app.start.${appStartType}`]);
  const queryString = `${appendReleaseFilters(
    query,
    primaryRelease,
    secondaryRelease
  )} span.description:["Cold Start","Warm Start"]`;

  const {data: series, isLoading: isSeriesLoading} = useEventsStatsQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        topEvents: '2',
        fields: ['release', 'count()'],
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

  const transformedSeries = Object.values(transformData(series, primaryRelease)).sort(
    (releaseA, _releaseB) => {
      return releaseA.seriesName === primaryRelease ? -1 : 1;
    }
  );

  const truncatedPrimaryChart = formatVersionAndCenterTruncate(
    primaryRelease ?? '',
    MAX_CHART_RELEASE_CHARS
  );
  const truncatedSecondaryChart = formatVersionAndCenterTruncate(
    secondaryRelease ?? '',
    MAX_CHART_RELEASE_CHARS
  );

  return (
    <MiniChartPanel
      title={t('Count')}
      subtitle={
        primaryRelease
          ? t(
              '%s v. %s',
              truncatedPrimaryChart,
              secondaryRelease ? truncatedSecondaryChart : ''
            )
          : ''
      }
    >
      <Chart
        data={transformedSeries}
        height={chartHeight}
        loading={isSeriesLoading || isReleasesLoading}
        grid={{
          left: '0',
          right: '0',
          top: space(2),
          bottom: '0',
        }}
        showLegend
        definedAxisTicks={2}
        isLineChart
        aggregateOutputFormat={OUTPUT_TYPE[YAxis.COUNT]}
        tooltipFormatterOptions={{
          valueFormatter: value =>
            tooltipFormatterUsingAggregateOutputType(value, OUTPUT_TYPE[YAxis.COUNT]),
          nameFormatter: value => formatVersion(value),
        }}
        legendFormatter={value => formatVersion(value)}
      />
    </MiniChartPanel>
  );
}
