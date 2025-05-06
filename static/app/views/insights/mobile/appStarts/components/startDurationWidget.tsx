import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import type {MultiSeriesEventsStats} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {tooltipFormatterUsingAggregateOutputType} from 'sentry/utils/discover/charts';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {
  PRIMARY_RELEASE_COLOR,
  SECONDARY_RELEASE_COLOR,
} from 'sentry/views/insights/colors';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import MiniChartPanel from 'sentry/views/insights/common/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {useTopNSpanMetricsSeries} from 'sentry/views/insights/common/queries/useTopNDiscoverSeries';
import {formatVersionAndCenterTruncate} from 'sentry/views/insights/common/utils/centerTruncate';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {COLD_START_TYPE} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {SpanMetricsField} from 'sentry/views/insights/types';

const COLD_START_CONDITIONS = [
  'span.op:app.start.cold',
  'span.description:["Cold Start","Cold App Start"]',
];
const WARM_START_CONDITIONS = [
  'span.op:app.start.warm',
  'span.description:["Warm Start","Warm App Start"]',
];

export function transformData(data?: MultiSeriesEventsStats, primaryRelease?: string) {
  const transformedSeries: Record<string, Series> = {};

  if (defined(data)) {
    Object.keys(data).forEach(releaseName => {
      transformedSeries[releaseName] = {
        seriesName: releaseName,
        data:
          data[releaseName]?.data?.map(datum => {
            return {
              name: datum[0] * 1000,
              value: datum[1][0]!.count,
            } as SeriesDataUnit;
          }) ?? [],
        ...(primaryRelease === releaseName
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
  chartHeight: number;
  additionalFilters?: string[];
}

function StartDurationWidget({additionalFilters, chartHeight}: Props) {
  const location = useLocation();
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const startType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const query = new MutableSearch([
    ...(startType === COLD_START_TYPE ? COLD_START_CONDITIONS : WARM_START_CONDITIONS),
    ...(additionalFilters ?? []),
  ]);

  if (isProjectCrossPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const {
    data,
    isPending: isSeriesLoading,
    error: seriesError,
  } = useTopNSpanMetricsSeries(
    {
      yAxis: ['avg(span.duration)'],
      fields: ['release', 'avg(span.duration)'],
      topN: 2,
      search: queryString,
      enabled: !isReleasesLoading,
    },
    'api.starfish.mobile-startup-series'
  );

  const series = data[0] ?? {};

  // The expected response is a multi series response, but if there is no data
  // then we get an object representing a single series with all empty values
  // (i.e without being grouped by release)
  const hasReleaseData = series && data.length > 0;

  // Only transform the data is we know there's at least one release
  const transformedSeries = hasReleaseData
    ? data.sort((releaseA, _releaseB) =>
        releaseA.seriesName === primaryRelease ? -1 : 1
      )
    : [];

  return (
    <MiniChartPanel
      title={
        startType === COLD_START_TYPE ? t('Average Cold Start') : t('Average Warm Start')
      }
      subtitle={
        primaryRelease
          ? t(
              '%s v. %s',
              formatVersionAndCenterTruncate(primaryRelease, 12),
              secondaryRelease ? formatVersionAndCenterTruncate(secondaryRelease, 12) : ''
            )
          : ''
      }
    >
      <Chart
        data={transformedSeries}
        height={chartHeight}
        loading={isSeriesLoading}
        grid={{
          left: '0',
          right: '0',
          top: space(2),
          bottom: '0',
        }}
        showLegend
        definedAxisTicks={2}
        type={ChartType.LINE}
        aggregateOutputFormat="duration"
        tooltipFormatterOptions={{
          valueFormatter: value =>
            tooltipFormatterUsingAggregateOutputType(value, 'duration'),
          nameFormatter: value => formatVersion(value),
        }}
        legendFormatter={value => formatVersion(value)}
        error={seriesError}
      />
    </MiniChartPanel>
  );
}

export default StartDurationWidget;
