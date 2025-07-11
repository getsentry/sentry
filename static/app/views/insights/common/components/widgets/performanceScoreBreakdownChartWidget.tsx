import {useTheme} from '@emotion/react';

import {t} from 'sentry/locale';
import {decodeList} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import {WebVitalsWeightList} from 'sentry/views/insights/browser/webVitals/components/charts/webVitalWeightList';
import {DEFAULT_QUERY_FILTER} from 'sentry/views/insights/browser/webVitals/settings';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {getWeights} from 'sentry/views/insights/browser/webVitals/utils/getWeights';
import decodeBrowserTypes from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {InsightsTimeSeriesWidget} from 'sentry/views/insights/common/components/insightsTimeSeriesWidget';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {
  type DiscoverSeries,
  useMetricsSeries,
} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {SpanIndexedField, SpanMetricsField} from 'sentry/views/insights/types';

export default function PerformanceScoreBreakdownChartWidget(
  props: LoadableChartWidgetProps
) {
  const {
    transaction,
    [SpanIndexedField.BROWSER_NAME]: browserTypes,
    [SpanIndexedField.USER_GEO_SUBREGION]: subregions,
  } = useLocationQuery({
    fields: {
      [SpanIndexedField.BROWSER_NAME]: decodeBrowserTypes,
      [SpanIndexedField.USER_GEO_SUBREGION]: decodeList,
      transaction: decodeList,
    },
  });
  const theme = useTheme();
  const segmentColors = theme.chart.getColorPalette(4).slice(0, 5);
  const search = new MutableSearch(
    `${DEFAULT_QUERY_FILTER} has:measurements.score.total`
  );

  if (transaction.length && transaction[0]) {
    search.addFilterValue('transaction', transaction[0]);
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
    'api.performance.browser.web-vitals.timeseries-scores2',
    props.pageFilters
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
    <InsightsTimeSeriesWidget
      {...props}
      id="performanceScoreBreakdownChartWidget"
      title={t('Score Breakdown')}
      height="100%"
      visualizationType="area"
      isLoading={areVitalScoresLoading}
      error={vitalScoresError}
      series={allSeries}
      description={<WebVitalsWeightList weights={weights} />}
    />
  );
}
