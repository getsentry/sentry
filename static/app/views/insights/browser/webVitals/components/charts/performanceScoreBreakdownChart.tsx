import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import {
  useProjectWebVitalsScoresTimeseriesQuery,
  type WebVitalsScoreBreakdown,
} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {applyStaticWeightsToTimeseries} from 'sentry/views/insights/browser/webVitals/utils/applyStaticWeightsToTimeseries';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/insights/browser/webVitals/utils/scoreThresholds';
import Chart, {ChartType} from 'sentry/views/insights/common/components/chart';
import ChartPanel from 'sentry/views/insights/common/components/chartPanel';
import type {SubregionCode} from 'sentry/views/insights/types';

type Props = {
  browserTypes?: BrowserType[];
  subregions?: SubregionCode[];
  transaction?: string;
};

export function formatTimeSeriesResultsToChartData(
  data: WebVitalsScoreBreakdown,
  segmentColors: string[],
  order: WebVitals[] = ORDER
): Series[] {
  return order.map((webVital, index) => {
    const series = data[webVital];
    const color = segmentColors[index];
    return {
      seriesName: webVital.toUpperCase(),
      data: series.map(({name, value}) => ({
        name,
        value: Math.round(value),
      })),
      color,
    };
  });
}

export function PerformanceScoreBreakdownChart({
  transaction,
  browserTypes,
  subregions,
}: Props) {
  const organization = useOrganization();
  const theme = useTheme();
  const segmentColors = [...theme.charts.getColorPalette(3).slice(0, 5)];

  const pageFilters = usePageFilters();
  const handleMissingWebVitals = organization.features.includes(
    'performance-vitals-handle-missing-webvitals'
  );

  const {data: timeseriesData, isLoading: isTimeseriesLoading} =
    useProjectWebVitalsScoresTimeseriesQuery({transaction, browserTypes, subregions});

  const period = pageFilters.selection.datetime.period;
  const performanceScoreSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';
  const chartSeriesOrder = ORDER;

  const weightedTimeseriesData = applyStaticWeightsToTimeseries(
    organization,
    timeseriesData
  );

  const weightedTimeseries = formatTimeSeriesResultsToChartData(
    weightedTimeseriesData,
    segmentColors,
    chartSeriesOrder
  );

  const timeseries = formatTimeSeriesResultsToChartData(
    {
      lcp: timeseriesData.lcp,
      fcp: timeseriesData.fcp,
      cls: timeseriesData.cls,
      ttfb: timeseriesData.ttfb,
      inp: timeseriesData.inp,
      total: timeseriesData.total,
    },
    segmentColors,
    chartSeriesOrder
  );

  const weights = handleMissingWebVitals
    ? getWeights(
        ORDER.filter(webVital =>
          timeseriesData[webVital].some(series => series.value > 0)
        )
      )
    : PERFORMANCE_SCORE_WEIGHTS;

  return (
    <StyledChartPanel title={t('Score Breakdown')}>
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
          nameFormatter: name => {
            // nameFormatter expects a string an will wrap the output in an html string.
            // Kind of a hack, but we can inject some html to escape styling for the subLabel.
            const subLabel =
              weights !== undefined
                ? ` </strong>(${weights[name.toLocaleLowerCase()].toFixed(
                    0
                  )}% of Perf Score)<strong>`
                : '';
            return `${name} Score${subLabel}`;
          },
          valueFormatter: (_value, _label, seriesParams: any) => {
            const timestamp = seriesParams?.data[0];
            const value = timeseries
              .find(series => series.seriesName === seriesParams?.seriesName)
              ?.data.find(dataPoint => dataPoint.name === timestamp)?.value;
            return `<span class="tooltip-label-value">${value}</span>`;
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
