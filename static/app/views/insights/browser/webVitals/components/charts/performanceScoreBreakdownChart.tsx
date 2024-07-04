import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/components/browserTypeSelector';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {
  type UnweightedWebVitalsScoreBreakdown,
  useProjectWebVitalsScoresTimeseriesQuery,
  type WebVitalsScoreBreakdown,
} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';

type Props = {
  browserType?: BrowserType;
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

export function PerformanceScoreBreakdownChart({transaction, browserType}: Props) {
  const theme = useTheme();
  const segmentColors = [...theme.charts.getColorPalette(3).slice(0, 5)];

  const pageFilters = usePageFilters();

  const {data: timeseriesData, isLoading: isTimeseriesLoading} =
    useProjectWebVitalsScoresTimeseriesQuery({transaction, browserType});
  const {data: projectScores, isLoading: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({transaction, browserType});

  const projectScore = isProjectScoresLoading
    ? undefined
    : calculatePerformanceScoreFromStoredTableDataRow(projectScores?.data?.[0]);

  const period = pageFilters.selection.datetime.period;
  const performanceScoreSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';
  const chartSeriesOrder = ORDER;

  const weightedTimeseries = formatTimeSeriesResultsToChartData(
    timeseriesData,
    segmentColors,
    false,
    chartSeriesOrder
  );

  const storedScores = timeseriesData as WebVitalsScoreBreakdown &
    UnweightedWebVitalsScoreBreakdown;

  const unweightedTimeseries = formatTimeSeriesResultsToChartData(
    {
      lcp: storedScores.unweightedLcp,
      fcp: storedScores.unweightedFcp,
      cls: storedScores.unweightedCls,
      ttfb: storedScores.unweightedTtfb,
      inp: storedScores.unweightedInp,
      total: storedScores.total,
    },
    segmentColors,
    false,
    chartSeriesOrder
  );

  const weightsSeries = weightedTimeseries[0].data.map(({name}) => {
    const value =
      projectScore !== undefined
        ? {
            lcp: projectScore.lcpWeight,
            fcp: projectScore.fcpWeight,
            inp: projectScore.inpWeight,
            cls: projectScore.clsWeight,
            ttfb: projectScore.ttfbWeight,
          }
        : undefined;
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
        loading={isTimeseriesLoading || isProjectScoresLoading}
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
