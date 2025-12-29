import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {BarChart} from 'sentry/components/charts/barChart';
import {Button} from 'sentry/components/core/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {PRIMARY_RELEASE_COLOR} from 'sentry/views/insights/colors';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {ChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import {
  ChartContainer,
  ModalChartContainer,
} from 'sentry/views/insights/common/components/insightsChartContainer';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {COLD_START_TYPE} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import {Referrer} from 'sentry/views/insights/mobile/appStarts/referrers';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {YAxis, YAXIS_COLUMNS} from 'sentry/views/insights/mobile/screenload/constants';
import {transformDeviceClassEvents} from 'sentry/views/insights/mobile/screenload/utils';
import {SpanFields, type SpanProperty} from 'sentry/views/insights/types';
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
  const theme = useTheme();
  const location = useLocation();
  const {query: locationQuery} = location;
  const {primaryRelease, isLoading: isReleasesLoading} = useReleaseSelection();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const startType =
    decodeScalar(location.query[SpanFields.APP_START_TYPE]) ?? COLD_START_TYPE;
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
  query.addFilterValue('is_transaction', 'true');

  const search = new MutableSearch(appendReleaseFilters(query, primaryRelease));
  const referrer = Referrer.DEVICE_CLASS_BREAKDOWN_BAR_CHART;
  const appStartMetric: SpanProperty =
    startType === COLD_START_TYPE
      ? 'avg(measurements.app_start_cold)'
      : 'avg(measurements.app_start_warm)';

  const groupBy: SpanProperty[] = [SpanFields.DEVICE_CLASS];
  if (defined(primaryRelease)) {
    groupBy.push(SpanFields.RELEASE);
  }
  groupBy.push(appStartMetric);

  const {
    data: startupDataByDeviceClass,
    isPending,
    error,
  } = useSpans(
    {
      enabled: !isReleasesLoading,
      search,
      fields: groupBy,
    },
    referrer
  );

  const transformedData = transformDeviceClassEvents({
    data: startupDataByDeviceClass,
    yAxes: YAXES,
    primaryRelease,
    theme,
  });

  const data = Object.values(
    transformedData[
      YAXIS_COLUMNS[startType === COLD_START_TYPE ? YAxis.COLD_START : YAxis.WARM_START]
    ]!
  );

  const title =
    startType === COLD_START_TYPE
      ? t('Cold Start Device Distribution')
      : t('Warm Start Device Distribution');

  const Title = <Widget.WidgetTitle title={title} />;

  if (isPending) {
    return (
      <ChartContainer height={chartHeight}>
        <Widget
          Title={Title}
          Visualization={<TimeSeriesWidgetVisualization.LoadingPlaceholder />}
        />
      </ChartContainer>
    );
  }

  if (error) {
    return (
      <ChartContainer height={chartHeight}>
        <Widget Title={Title} Visualization={<Widget.WidgetError error={error} />} />
      </ChartContainer>
    );
  }

  const Visualization = (
    <BarChart
      legend={{
        show: primaryRelease !== undefined,
        right: 12,
      }}
      autoHeightResize
      colors={[PRIMARY_RELEASE_COLOR]}
      series={
        data.map(series => ({
          ...series,
          data: series.data.map(datum =>
            datum.value === 0
              ? datum
              : {
                  ...datum,
                  itemStyle: {
                    color: PRIMARY_RELEASE_COLOR,
                  },
                }
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
  );

  return (
    <ChartContainer height={chartHeight}>
      <Widget
        Title={Title}
        Visualization={Visualization}
        Actions={
          <Widget.WidgetToolbar>
            <ChartActionDropdown
              chartType={ChartType.LINE}
              yAxes={[appStartMetric]}
              groupBy={groupBy as SpanFields[]}
              search={search}
              title={title}
              referrer={referrer}
            />
            <Button
              size="xs"
              aria-label={t('Open Full-Screen View')}
              borderless
              icon={<IconExpand />}
              onClick={() => {
                openInsightChartModal({
                  title: Title,
                  children: <ModalChartContainer>{Visualization}</ModalChartContainer>,
                });
              }}
            />
          </Widget.WidgetToolbar>
        }
      />
    </ChartContainer>
  );
}

export default DeviceClassBreakdownBarChart;
