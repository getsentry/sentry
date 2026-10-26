import {t} from 'sentry/locale';
import {isEquation, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {TraceMetricsConfig} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import type {AggregateSummary} from 'sentry/views/detectors/datasetConfig/base';
import {MetricsDetectorSearchBar} from 'sentry/views/detectors/datasetConfig/components/metricsSearchBar';
import {createEapDetectorConfig} from 'sentry/views/detectors/datasetConfig/eapBase';
import {transformEventsStatsToSeries} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';
import {getApiAggregateString} from 'sentry/views/detectors/datasetConfig/utils/getApiAggregateString';
import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';

/**
 * Summarizes an equation as the reference labels the edit form assigns (A, B, …), plus a
 * row per aggregate. Returns null for a single aggregate, which has nothing to break out.
 *
 * Aggregate filters come from their own `_if` combinator. The detector's filter applies
 * to the equation as a whole and is displayed separately.
 */
function summarizeEquation(aggregate: string): AggregateSummary | null {
  // The form omits the `equation|` prefix the API stores, so normalize with the same
  // helper used when saving.
  const {compactExpression, metricQueries} = parseAggregateExpression(
    getApiAggregateString(aggregate)
  );
  if (!compactExpression) {
    return null;
  }
  // A lone `_if` aggregate parses as a one function equation, collapsing to a bare "A".
  if (metricQueries.length === 1 && compactExpression === metricQueries[0]?.label) {
    return null;
  }

  return {
    // Tokens are space joined, so parentheses arrive as "( A + B )".
    expression: compactExpression.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')'),
    headers: [t('Application Metric'), t('Operation'), t('Filter')],
    components: metricQueries.map(metricQuery => {
      const yAxis = metricQuery.queryParams.visualizes[0]?.yAxis ?? '';
      const {aggregation} = parseMetricAggregate(yAxis);
      return {
        label: metricQuery.label ?? '',
        values: [metricQuery.metric.name, aggregation, metricQuery.queryParams.query],
      };
    }),
  };
}

export const DetectorMetricsConfig = createEapDetectorConfig({
  name: t('Application Metrics'),
  defaultEventTypes: [EventTypes.TRACE_ITEM_METRIC],
  defaultField: TraceMetricsConfig.defaultField,
  getAggregateOptions: TraceMetricsConfig.getTableFieldOptions,
  discoverDataset: DiscoverDatasets.TRACEMETRICS,
  SearchBar: MetricsDetectorSearchBar,
  supportsEquations: true,
  formatAggregateForTitle: aggregate => {
    if (aggregate === 'count()') {
      return t('Number of application metrics');
    }
    // Equations read better as their reference labels.
    const summary = summarizeEquation(aggregate);
    if (summary) {
      return summary.expression;
    }
    if (isEquation(aggregate)) {
      return stripEquationPrefix(aggregate);
    }
    return aggregate;
  },
  getAggregateSummary: summarizeEquation,
  transformSeriesQueryData: (data, aggregate) => {
    return [transformEventsStatsToSeries(data, aggregate)].map(s => {
      if (isEquation(s.seriesName)) {
        s.seriesName = stripEquationPrefix(s.seriesName);
      }
      return s;
    });
  },
  fromApiAggregate: aggregate => {
    if (isEquation(aggregate)) {
      return stripEquationPrefix(aggregate);
    }
    return aggregate;
  },
  toApiAggregate: aggregate => {
    return getApiAggregateString(aggregate);
  },
});
