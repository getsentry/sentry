import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import type {WebVitalsScoreBreakdown} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresTimeseriesQuery';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {InsightsTimeSeriesWidget} from 'sentry/views/insights/common/components/insightsTimeSeriesWidget';
import {
  type DiscoverSeries,
  useMetricsSeries,
} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {SpanMetricsField, type SubregionCode} from 'sentry/views/insights/types';

import {DEFAULT_QUERY_FILTER} from '../../settings';

import {WebVitalsWeightList} from './webVitalWeightList';

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
  const theme = useTheme();
  const segmentColors = theme.chart.getColorPalette(3).slice(0, 5);

  const search = new MutableSearch(
    `${DEFAULT_QUERY_FILTER} has:measurements.score.total`
  );

  if (transaction) {
    search.addFilterValue('transaction', transaction);
  }

  if (subregions) {
    search.addDisjunctionFilterValues(SpanMetricsField.USER_GEO_SUBREGION, subregions);
  }

  if (browserTypes) {
    search.addDisjunctionFilterValues(SpanMetricsField.BROWSER_NAME, browserTypes);
  }

  const {
    data: vitalScoresData,
    isLoading: areVitalScoresLoading,
    error: vitalScoresError,
  } = useMetricsSeries(
    {
      search,
      yAxis: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.inp)',
        'performance_score(measurements.score.ttfb)',
        'count()',
      ],
      transformAliasToInputFormat: true,
    },
    'api.performance.browser.web-vitals.timeseries-scores2'
  );

  const webVitalsThatHaveData: WebVitals[] = vitalScoresData
    ? ORDER.filter(webVital => {
        const key = `performance_score(measurements.score.${webVital})` as const;
        const series = vitalScoresData[key];

        return series.data.some(datum => datum.value > 0);
      })
    : [];

  const weights = getWeights(webVitalsThatHaveData);

  const allSeries: DiscoverSeries[] = vitalScoresData
    ? ORDER.map((webVital, index) => {
        const key = `performance_score(measurements.score.${webVital})` as const;
        const series = vitalScoresData[key];

        const scaledSeries: DiscoverSeries = {
          ...series,
          data: series.data.map(datum => {
            return {
              ...datum,
              value: datum.value * weights[webVital],
            };
          }),
          color: segmentColors[index],
          meta: {
            // TODO: The backend doesn't return these score fields with the "score" type yet. Fill this in manually for now.
            fields: {
              ...series.meta?.fields,
              [key]: 'score',
            },
            units: series.meta?.units,
          },
        };

        return scaledSeries;
      })
    : [];

  return (
    <ChartContainer>
      <InsightsTimeSeriesWidget
        title={t('Score Breakdown')}
        height="100%"
        visualizationType="area"
        isLoading={areVitalScoresLoading}
        error={vitalScoresError}
        series={allSeries}
        description={<WebVitalsWeightList weights={weights} />}
      />
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  flex: 1 1 0%;
`;
