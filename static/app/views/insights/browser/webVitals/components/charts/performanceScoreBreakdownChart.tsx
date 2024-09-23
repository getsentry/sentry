import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ALERTS} from 'sentry/views/insights/browser/webVitals/alerts';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import {
  useProjectWebVitalsScoresTimeseriesQuery,
  type WebVitalsScoreBreakdown,
} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import {applyStaticWeightsToTimeseries} from 'sentry/views/insights/browser/webVitals/utils/applyStaticWeightsToTimeseries';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import {SpanMetricsField, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  subregions?: SubregionCode[];
  transaction?: string;
};

export const formatTimeSeriesResultsToChartData = (
  data: WebVitalsScoreBreakdown,
  segmentColors: string[],
  useWeights = true,
  order = ORDER
): Series[] => {
  return order.map((webVital, index) => {
    const series = data[webVital];
    const color = segmentColors[index];
    return {
      seriesName: webVital.toUpperCase(),
      data: series.map(({name, value}) => ({
        name,
        value: Math.round(
          value * (useWeights ? PERFORMANCE_SCORE_WEIGHTS[webVital] : 100) * 0.01
        ),
      })),
      color,
    };
  });
};

export function PerformanceScoreBreakdownChart({
  transaction,
  browserTypes,
  subregions,
}: Props) {
  const theme = useTheme();
  const segmentColors = [...theme.charts.getColorPalette(3).slice(0, 5)];

  const pageFilters = usePageFilters();

  const {data: timeseriesData, isLoading: isTimeseriesLoading} =
    useProjectWebVitalsScoresTimeseriesQuery({transaction, browserTypes, subregions});

  const period = pageFilters.selection.datetime.period;
  const performanceScoreSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';
  const chartSeriesOrder = ORDER;

  const weightedTimeseriesData = applyStaticWeightsToTimeseries(timeseriesData);

  const weightedTimeseries = formatTimeSeriesResultsToChartData(
    weightedTimeseriesData,
    segmentColors,
    false,
    chartSeriesOrder
  );

  const unweightedTimeseries = formatTimeSeriesResultsToChartData(
    {
      lcp: timeseriesData.unweightedLcp,
      fcp: timeseriesData.unweightedFcp,
      cls: timeseriesData.unweightedCls,
      ttfb: timeseriesData.unweightedTtfb,
      inp: timeseriesData.unweightedInp,
      total: timeseriesData.total,
    },
    segmentColors,
    false,
    chartSeriesOrder
  );

  const weightsSeries = weightedTimeseries[0].data.map(({name}) => {
    const value = PERFORMANCE_SCORE_WEIGHTS;
    return {name, value};
  });

  // We need to reproduce the same query filters that were used to fetch the timeseries data so that they can be propagated to the alerts
  const search = new MutableSearch(ALERTS.total.query ?? '');
  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }
  if (subregions) {
    search.addDisjunctionFilterValues(SpanMetricsField.USER_GEO_SUBREGION, subregions);
  }
  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanMetricsField.BROWSER_NAME, browserTypes);
  }
  const query = [DEFAULT_QUERY_FILTER, search.formatString()].join(' ').trim();

  return (
    <StyledChartPanel
      title={t('Score Breakdown')}
      alertConfigs={Object.values(ALERTS).map(alertConfig => ({...alertConfig, query}))}
    >
      <PerformanceScoreSubtext>{performanceScoreSubtext}</PerformanceScoreSubtext>
      <Chart
        stacked
        hideYAxisSplitLine
        height={180}
        data={isTimeseriesLoading ? [] : weightedTimeseries}
        disableXAxis
        loading={isTimeseriesLoading}
        type={ChartType.AREA}
        grid={{
          left: 5,
          right: 5,
          top: 5,
          bottom: 0,
        }}
        dataMax={100}
        chartColors={segmentColors}
        tooltipFormatterOptions={{
          nameFormatter: (name, seriesParams: any) => {
            const timestamp = seriesParams?.data[0];
            const weights = weightsSeries.find(
              series => series.name === timestamp
            )?.value;
            // nameFormatter expects a string an will wrap the output in an html string.
            // Kind of a hack, but we can inject some html to escape styling for the subLabel.
            const subLabel =
              weights !== undefined
                ? ` </strong>(${
                    weights[name.toLocaleLowerCase()]
                  }% of Perf Score)<strong>`
                : '';
            return `${name} Score${subLabel}`;
          },
          valueFormatter: (_value, _label, seriesParams: any) => {
            const timestamp = seriesParams?.data[0];
            const unweightedValue = unweightedTimeseries
              .find(series => series.seriesName === seriesParams?.seriesName)
              ?.data.find(dataPoint => dataPoint.name === timestamp)?.value;
            return `<span class="tooltip-label-value">${unweightedValue}</span>`;
          },
        }}
      />
    </StyledChartPanel>
  );
}

const StyledChartPanel = styled(ChartPanel)`
  flex: 1;
`;

const PerformanceScoreSubtext = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;
