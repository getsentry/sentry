import {BarChart} from 'sentry/components/charts/barChart';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import TransitionChart from 'sentry/components/charts/transitionChart';
import {getInterval} from 'sentry/components/charts/utils';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import EventView from 'sentry/utils/discover/eventView';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
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
import {LoadingScreen} from 'sentry/views/insights/common/components/chart';
import MiniChartPanel from 'sentry/views/insights/common/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/insights/common/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/insights/common/utils/constants';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {COLD_START_TYPE} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/insights/mobile/screenload/constants';
import {transformDeviceClassEvents} from 'sentry/views/insights/mobile/screenload/utils';
import {SpanMetricsField} from 'sentry/views/insights/types';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';

const YAXES = [YAxis.COLD_START, YAxis.WARM_START];
const XAXIS_CATEGORIES = ['high', 'medium', 'low', 'Unknown'];

interface DeviceClassBreakdownBarChartProps {
  additionalFilters?: string[];
  chartHeight?: number;
}

function DeviceClassBreakdownBarChart({
  chartHeight,
  additionalFilters,
}: DeviceClassBreakdownBarChartProps) {
  const pageFilter = usePageFilters();
  const location = useLocation();
  const {query: locationQuery} = location;
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const startType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;
  const yAxis =
    YAXIS_COLUMNS[startType === COLD_START_TYPE ? YAxis.COLD_START : YAxis.WARM_START];
  const query = new MutableSearch([...(additionalFilters ?? [])]);

  if (isProjectCrossPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const {
    data: startupDataByDeviceClass,
    isPending,
    isError,
  } = useTableQuery({
    eventView: EventView.fromNewQueryWithPageFilters(
      {
        name: '',
        fields: [
          startType === COLD_START_TYPE
            ? 'avg(measurements.app_start_cold)'
            : 'avg(measurements.app_start_warm)',
          'device.class',
          'release',
        ],
        yAxis: YAXES.map(val => YAXIS_COLUMNS[val]),
        query: queryString,
        dataset: DiscoverDatasets.METRICS,
        version: 2,
        interval: getInterval(
          pageFilter.selection.datetime,
          STARFISH_CHART_INTERVAL_FIDELITY
        ),
      },
      pageFilter.selection
    ),
    enabled: !isReleasesLoading,
    referrer: 'api.starfish.mobile-startup-bar-chart',
    initialData: {data: []},
  });

  const transformedData = transformDeviceClassEvents({
    data: startupDataByDeviceClass,
    yAxes: YAXES,
    primaryRelease,
    secondaryRelease,
  });

  const data = Object.values(
    transformedData[
      YAXIS_COLUMNS[startType === COLD_START_TYPE ? YAxis.COLD_START : YAxis.WARM_START]
    ]!
  );

  return (
    <MiniChartPanel
      title={
        startType === COLD_START_TYPE
          ? t('Cold Start Device Distribution')
          : t('Warm Start Device Distribution')
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
      <TransitionChart
        loading={isPending || isReleasesLoading}
        reloading={isPending || isReleasesLoading}
        height={`${chartHeight}px`}
      >
        <LoadingScreen loading={Boolean(isPending)} />
        {isError ? (
          <ErrorPanel height={`${chartHeight}px`}>
            <IconWarning color="gray300" size="lg" />
          </ErrorPanel>
        ) : (
          <BarChart
            legend={{
              show: true,
              right: 12,
            }}
            height={chartHeight}
            colors={[PRIMARY_RELEASE_COLOR, SECONDARY_RELEASE_COLOR]}
            series={
              data.map(series => ({
                ...series,
                data: series.data.map(datum =>
                  datum.value !== 0
                    ? {
                        ...datum,
                        itemStyle: {
                          color:
                            series.seriesName === primaryRelease
                              ? PRIMARY_RELEASE_COLOR
                              : SECONDARY_RELEASE_COLOR,
                        },
                      }
                    : datum
                ),
                name: formatVersion(series.seriesName),
              })) ?? []
            }
            grid={{
              left: '0',
              right: '0',
              top: space(2),
              bottom: '0',
              containLabel: true,
            }}
            xAxis={{
              type: 'category',
              axisTick: {show: true},
              data: XAXIS_CATEGORIES,
              truncate: 14,
              axisLabel: {
                interval: 0,
              },
            }}
            yAxis={{
              axisLabel: {
                formatter(value: number) {
                  return axisLabelFormatter(
                    value,
                    aggregateOutputType(yAxis),
                    undefined,
                    getDurationUnit(data ?? [])
                  );
                },
              },
            }}
            tooltip={{
              valueFormatter: (value, _seriesName) => {
                return tooltipFormatter(value, aggregateOutputType(yAxis));
              },
            }}
          />
        )}
      </TransitionChart>
    </MiniChartPanel>
  );
}

export default DeviceClassBreakdownBarChart;
