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
import {formatVersion} from 'sentry/utils/formatters';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {prepareQueryForLandingPage} from 'sentry/views/performance/data';
import {
  PRIMARY_RELEASE_COLOR,
  SECONDARY_RELEASE_COLOR,
} from 'sentry/views/starfish/colours';
import {LoadingScreen} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {STARFISH_CHART_INTERVAL_FIDELITY} from 'sentry/views/starfish/utils/constants';
import {appendReleaseFilters} from 'sentry/views/starfish/utils/releaseComparison';
import {COLD_START_TYPE} from 'sentry/views/starfish/views/appStartup/screenSummary/startTypeSelector';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/starfish/views/screens';
import {useTableQuery} from 'sentry/views/starfish/views/screens/screensTable';
import {transformDeviceClassEvents} from 'sentry/views/starfish/views/screens/utils';

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

  const startType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;
  const yAxis =
    YAXIS_COLUMNS[startType === COLD_START_TYPE ? YAxis.COLD_START : YAxis.WARM_START];
  const query = new MutableSearch([...(additionalFilters ?? [])]);

  const searchQuery = decodeScalar(locationQuery.query, '');
  if (searchQuery) {
    query.addStringFilter(prepareQueryForLandingPage(searchQuery, false));
  }

  const queryString = appendReleaseFilters(query, primaryRelease, secondaryRelease);

  const {
    data: startupDataByDeviceClass,
    isLoading,
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
    ]
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
        loading={isLoading || isReleasesLoading}
        reloading={isLoading || isReleasesLoading}
        height={`${chartHeight}px`}
      >
        <LoadingScreen loading={Boolean(isLoading)} />
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
