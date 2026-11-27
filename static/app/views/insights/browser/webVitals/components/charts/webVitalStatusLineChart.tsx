import styled from '@emotion/styled';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {webVitalP75Field} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {Thresholds} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/thresholds';
import {WEB_VITAL_FULL_NAME_MAP} from 'sentry/views/insights/browser/webVitals/components/webVitalDescription';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {
  DEFAULT_QUERY_FILTER,
  FIELD_ALIASES,
} from 'sentry/views/insights/browser/webVitals/settings';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {WEB_VITAL_TO_FIELD} from 'sentry/views/insights/browser/webVitals/types';
import {
  addBrowserFilter,
  getMetricsSearch,
  type DeviceType,
} from 'sentry/views/insights/browser/webVitals/utils/deviceType';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {getWebVitalScoreThresholds} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {SubregionCode} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

interface Props {
  deviceType: DeviceType;
  webVital: WebVitals | null;
  browserTypes?: BrowserType[];
  metricsQuery?: string;
  subregions?: SubregionCode[];
  transaction?: string;
}

export function WebVitalStatusLineChart({
  webVital,
  transaction,
  browserTypes,
  deviceType,
  subregions,
  metricsQuery,
}: Props) {
  const isMetrics = metricsQuery !== undefined;
  const search = new MutableSearch(DEFAULT_QUERY_FILTER);
  const referrer = Referrer.WEB_VITAL_STATUS_LINE_CHART;

  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  addBrowserFilter(search, browserTypes, deviceType);
  if (subregions?.length) {
    search.addFilterValueList(SpanFields.USER_GEO_SUBREGION, subregions);
  }

  const yAxis = webVital
    ? isMetrics
      ? webVitalP75Field(webVital)
      : `p75(${WEB_VITAL_TO_FIELD[webVital]})`
    : undefined;

  const {
    data: timeseriesData,
    isLoading: isTimeseriesLoading,
    error: timeseriesError,
  } = useFetchEventsTimeSeries(
    isMetrics ? DiscoverDatasets.TRACEMETRICS : DiscoverDatasets.SPANS,
    {
      query: isMetrics
        ? getMetricsSearch(metricsQuery, browserTypes, deviceType)
        : search,
      yAxis: yAxis ? [yAxis] : [],
      enabled: !!webVital,
    },
    referrer
  );

  const timeSeries = timeseriesData?.timeSeries || [];
  const webVitalTimeSeries = timeSeries.find(ts => ts.yAxis === yAxis);

  const extraPlottables: Plottable[] = [];
  if (!isTimeseriesLoading && webVital) {
    const scoreThresholds = getWebVitalScoreThresholds(webVital, deviceType);
    const includePoorThreshold = webVitalTimeSeries?.values.some(
      ({value}) => (value || 0) > scoreThresholds.median
    );
    const includeMehThreshold = webVitalTimeSeries?.values.some(
      ({value}) => (value || 0) >= scoreThresholds.p90
    );
    extraPlottables.push(
      new Thresholds({
        thresholds: {
          max_values: {
            max1: includeMehThreshold ? scoreThresholds.p90 : undefined,
            max2: includePoorThreshold ? scoreThresholds.median : undefined,
          },
          unit: 'ms',
        },
        showLabels: true,
      })
    );
  }

  return (
    <ChartContainer>
      {webVital && (
        <InsightsLineChartWidget
          title={`${WEB_VITAL_FULL_NAME_MAP[webVital]} (P75)`}
          aliases={isMetrics && yAxis ? {[yAxis]: webVital.toUpperCase()} : FIELD_ALIASES}
          showReleaseAs="none"
          showLegend="never"
          isLoading={isTimeseriesLoading}
          error={timeseriesError}
          timeSeries={webVitalTimeSeries ? [webVitalTimeSeries] : []}
          extraPlottables={extraPlottables}
          // The chart menu opens spans in Explore
          queryInfo={isMetrics ? undefined : {search, referrer}}
          height={250}
        />
      )}
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  position: relative;
  padding-bottom: ${p => p.theme.space.xl};
`;
