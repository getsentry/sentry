import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import {
  useProjectWebVitalsScoresTimeseriesQuery,
  type WebVitalsScoreBreakdown,
} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import {applyStaticWeightsToTimeseries} from 'sentry/views/insights/browser/webVitals/utils/applyStaticWeightsToTimeseries';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import type {SubregionCode} from 'sentry/views/insights/types';

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

  return (
    <ChartContainer>
      <PerformanceScoreLabel>{t('Score Breakdown')}</PerformanceScoreLabel>
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
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  padding: ${space(2)} ${space(2)} ${space(1)} ${space(2)};
  flex: 1;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
  min-width: 320px;
`;

const PerformanceScoreLabel = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const PerformanceScoreSubtext = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;
