import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {
  PRIMARY_RELEASE_COLOR,
  SECONDARY_RELEASE_COLOR,
} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import MiniChartPanel from 'sentry/views/insights/common/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {useEventsStatsQuery} from 'sentry/views/insights/common/utils/useEventsStatsQuery';
import {COLD_START_TYPE} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import useTruncatedReleaseNames from 'sentry/views/insights/mobile/common/queries/useTruncatedRelease';
import {OUTPUT_TYPE, YAxis} from 'sentry/views/insights/mobile/screenload/constants';
import {SpanMetricsField} from 'sentry/views/insights/types';

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
              value: datum[1]![0]!.count,
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
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const appStartType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const query = new MutableSearch([`span.op:app.start.${appStartType}`]);

  if (isProjectCrossPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }

  const queryString = `${appendReleaseFilters(
    query,
    primaryRelease,
    secondaryRelease
  )} span.description:["Cold Start","Warm Start"]`;

  const {data: series, isPending: isSeriesLoading} = useEventsStatsQuery({
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

  const {truncatedPrimaryRelease, truncatedSecondaryRelease} = useTruncatedReleaseNames();

  const chartTitle =
    appStartType === COLD_START_TYPE ? t('Cold Start Count') : t('Warm Start Count');

  return (
    <MiniChartPanel
      title={chartTitle}
      subtitle={
        primaryRelease
          ? t(
              '%s v. %s',
              truncatedPrimaryRelease,
              secondaryRelease ? truncatedSecondaryRelease : ''
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
        type={ChartType.LINE}
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
