import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {Thresholds} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/thresholds';
import {WEB_VITAL_FULL_NAME_MAP} from 'sentry/views/insights/browser/webVitals/components/webVitalDescription';
import {Referrer} from 'sentry/views/insights/browser/webVitals/referrers';
import {
  DEFAULT_QUERY_FILTER,
  FIELD_ALIASES,
} from 'sentry/views/insights/browser/webVitals/settings';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {
  PERFORMANCE_SCORE_MEDIANS,
  PERFORMANCE_SCORE_P90S,
} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';
// eslint-disable-next-line no-restricted-imports
import {InsightsLineChartWidget} from 'sentry/views/insights/common/components/insightsLineChartWidget';
import type {SubregionCode} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

interface Props {
  webVital: WebVitals | null;
  browserTypes?: BrowserType[];
  subregions?: SubregionCode[];
  transaction?: string;
}

export function WebVitalStatusLineChart({
  webVital,
  transaction,
  browserTypes,
  subregions,
}: Props) {
  const webVitalP90 = webVital ? PERFORMANCE_SCORE_P90S[webVital] : 0;
  const webVitalMedian = webVital ? PERFORMANCE_SCORE_MEDIANS[webVital] : 0;

  const search = new MutableSearch(DEFAULT_QUERY_FILTER);
  const referrer = Referrer.WEB_VITAL_STATUS_LINE_CHART;

  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanFields.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanFields.USER_GEO_SUBREGION, subregions);
  }

  const {
    data: timeseriesData,
    isLoading: isTimeseriesLoading,
    error: timeseriesError,
  } = useFetchSpanTimeSeries(
    {
      query: search,
      yAxis: webVital ? [`p75(measurements.${webVital})`] : [],
      enabled: !!webVital,
    },
    referrer
  );

  const timeSeries = timeseriesData?.timeSeries || [];
  const webVitalTimeSeries = webVital
    ? timeSeries.find(ts => ts.yAxis === `p75(measurements.${webVital})`)
    : undefined;

  const includePoorThreshold = webVitalTimeSeries?.values.some(
    ({value}) => (value || 0) > webVitalMedian
  );
  const includeMehThreshold = webVitalTimeSeries?.values.some(
    ({value}) => (value || 0) >= webVitalP90
  );

  const thresholdsPlottable = new Thresholds({
    thresholds: {
      max_values: {
        max1: includeMehThreshold ? webVitalP90 : undefined,
        max2: includePoorThreshold ? webVitalMedian : undefined,
      },
      unit: 'ms',
    },
    showLabels: true,
  });

  const extraPlottables: Plottable[] = isTimeseriesLoading ? [] : [thresholdsPlottable];

  return (
    <ChartContainer>
      {webVital && (
        <InsightsLineChartWidget
          title={`${WEB_VITAL_FULL_NAME_MAP[webVital]} (P75)`}
          aliases={FIELD_ALIASES}
          showReleaseAs="none"
          showLegend="never"
          isLoading={isTimeseriesLoading}
          error={timeseriesError}
          timeSeries={webVitalTimeSeries ? [webVitalTimeSeries] : []}
          extraPlottables={extraPlottables}
          queryInfo={{
            search,
            referrer,
          }}
          height={250}
        />
      )}
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  position: relative;
  flex: 1;
  padding-bottom: ${space(2)};
`;
