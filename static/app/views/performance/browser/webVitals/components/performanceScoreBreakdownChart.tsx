import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import MarkLine from 'sentry/components/charts/components/markLine';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {
  useProjectRawWebVitalsTimeseriesQuery,
  WebVitalsScoreBreakdown,
} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsTimeseriesQuery';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {UnweightedWebVitalsScoreBreakdown} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import {useProjectWebVitalsTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useProjectWebVitalsTimeseriesQuery';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import Chart from 'sentry/views/starfish/components/chart';

export const SCORE_MIGRATION_TIMESTAMP = 1702771200000;

const {
  lcp: LCP_WEIGHT,
  fcp: FCP_WEIGHT,
  fid: FID_WEIGHT,
  cls: CLS_WEIGHT,
  ttfb: TTFB_WEIGHT,
} = PERFORMANCE_SCORE_WEIGHTS;

type Props = {
  transaction?: string;
};

export const formatTimeSeriesResultsToChartData = (
  data: WebVitalsScoreBreakdown,
  segmentColors: string[],
  useWeights = true
): Series[] => {
  return [
    {
      data: data?.lcp.map(({name, value}) => ({
        name,
        value: Math.round(value * (useWeights ? LCP_WEIGHT : 100) * 0.01),
      })),
      seriesName: 'LCP',
      color: segmentColors[0],
    },
    {
      data: data?.fcp.map(
        ({name, value}) => ({
          name,
          value: Math.round(value * (useWeights ? FCP_WEIGHT : 100) * 0.01),
        }),
        []
      ),
      seriesName: 'FCP',
      color: segmentColors[1],
    },
    {
      data: data?.fid.map(
        ({name, value}) => ({
          name,
          value: Math.round(value * (useWeights ? FID_WEIGHT : 100) * 0.01),
        }),
        []
      ),
      seriesName: 'FID',
      color: segmentColors[2],
    },
    {
      data: data?.cls.map(
        ({name, value}) => ({
          name,
          value: Math.round(value * (useWeights ? CLS_WEIGHT : 100) * 0.01),
        }),
        []
      ),
      seriesName: 'CLS',
      color: segmentColors[3],
    },
    {
      data: data?.ttfb.map(
        ({name, value}) => ({
          name,
          value: Math.round(value * (useWeights ? TTFB_WEIGHT : 100) * 0.01),
        }),
        []
      ),
      seriesName: 'TTFB',
      color: segmentColors[4],
    },
  ];
};

export function PerformanceScoreBreakdownChart({transaction}: Props) {
  const shouldUseStoredScores = useStoredScoresSetting();
  const theme = useTheme();
  const segmentColors = theme.charts.getColorPalette(3);

  const pageFilters = usePageFilters();

  const {start} = pageFilters.selection.datetime.period
    ? parseStatsPeriod(pageFilters.selection.datetime.period)
    : {
        start: pageFilters.selection.datetime.start,
      };

  const scoreMigrationTimestampAfterStart = moment(start).isBefore(
    SCORE_MIGRATION_TIMESTAMP
  );

  // When using stored/backend scores, we still need to fetch historic data to backfill for data.
  // We can disable this query if the score migration timestamp is not within the selected period.
  const {data: preMigrationTimeseriesData, isLoading: isRawScoreTimeseriesDataLoading} =
    useProjectRawWebVitalsTimeseriesQuery({
      transaction,
      enabled: shouldUseStoredScores && scoreMigrationTimestampAfterStart,
    });

  const {data: timeseriesData, isLoading: isTimeseriesLoading} =
    useProjectWebVitalsTimeseriesQuery({transaction});
  const {data: projectScores, isLoading: isProjectScoresLoading} =
    useProjectWebVitalsScoresQuery({transaction, enabled: shouldUseStoredScores});

  const projectScore =
    shouldUseStoredScores && isProjectScoresLoading
      ? undefined
      : calculatePerformanceScoreFromStoredTableDataRow(projectScores?.data?.[0]);

  const period = pageFilters.selection.datetime.period;
  const performanceScoreSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';

  const preMigrationWeightedTimeseries = formatTimeSeriesResultsToChartData(
    preMigrationTimeseriesData,
    segmentColors,
    true
  );
  let weightedTimeseries = formatTimeSeriesResultsToChartData(
    timeseriesData,
    segmentColors,
    !shouldUseStoredScores
  );

  weightedTimeseries = weightedTimeseries.map((series, index) => {
    const rawSeries = preMigrationWeightedTimeseries[index];
    const newSeries = {...series};
    newSeries.data = series.data.map(({name, value}) => {
      const rawValue = rawSeries.data.find(dataPoint => dataPoint.name === name)?.value;
      if ((name as number) <= SCORE_MIGRATION_TIMESTAMP && rawValue !== undefined) {
        return {
          name,
          value: rawValue,
        };
      }
      return {name, value};
    });
    return newSeries;
  });

  if (shouldUseStoredScores) {
    weightedTimeseries.push({
      seriesName: t('Mark Line'),
      data: [],
      markLine: MarkLine({
        lineStyle: {color: theme.blue400, type: 'solid', width: 1},
        data: [{xAxis: SCORE_MIGRATION_TIMESTAMP}],
      }),
    });
  }

  const storedScores = timeseriesData as WebVitalsScoreBreakdown &
    UnweightedWebVitalsScoreBreakdown;

  const preMigrationUnweightedTimeseries = formatTimeSeriesResultsToChartData(
    preMigrationTimeseriesData,
    segmentColors,
    false
  );

  let unweightedTimeseries = formatTimeSeriesResultsToChartData(
    shouldUseStoredScores
      ? {
          lcp: storedScores.unweightedLcp,
          fcp: storedScores.unweightedFcp,
          fid: storedScores.unweightedFid,
          cls: storedScores.unweightedCls,
          ttfb: storedScores.unweightedTtfb,
          total: storedScores.total,
        }
      : timeseriesData,
    segmentColors,
    false
  );

  unweightedTimeseries = unweightedTimeseries.map((series, index) => {
    const rawSeries = preMigrationUnweightedTimeseries[index];
    const newSeries = {...series};
    newSeries.data = series.data.map(({name, value}) => {
      const rawValue = rawSeries.data.find(dataPoint => dataPoint.name === name)?.value;
      if ((name as number) < SCORE_MIGRATION_TIMESTAMP && rawValue !== undefined) {
        return {
          name,
          value: rawValue,
        };
      }
      return {name, value};
    });
    return newSeries;
  });

  const weightsSeries = weightedTimeseries[0].data.map(({name}) => {
    const value =
      !shouldUseStoredScores || (name as number) <= SCORE_MIGRATION_TIMESTAMP
        ? PERFORMANCE_SCORE_WEIGHTS
        : projectScore !== undefined
        ? {
            lcp: projectScore.lcpWeight,
            fcp: projectScore.fcpWeight,
            fid: projectScore.fidWeight,
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
        height={180}
        data={
          isTimeseriesLoading ||
          (isRawScoreTimeseriesDataLoading && scoreMigrationTimestampAfterStart)
            ? []
            : weightedTimeseries
        }
        disableXAxis
        loading={
          isTimeseriesLoading ||
          (isRawScoreTimeseriesDataLoading && scoreMigrationTimestampAfterStart) ||
          (shouldUseStoredScores && isProjectScoresLoading)
        }
        grid={{
          left: 5,
          right: 5,
          top: 5,
          bottom: 0,
        }}
        dataMax={100}
        chartColors={segmentColors}
        preserveIncompletePoints
        tooltipFormatterOptions={{
          nameFormatter: (name, seriesParams: any) => {
            const timestamp = seriesParams?.data[0];
            const weights = weightsSeries.find(series => series.name === timestamp)
              ?.value;
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
`;

const PerformanceScoreLabel = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  font-weight: bold;
`;

const PerformanceScoreSubtext = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;
