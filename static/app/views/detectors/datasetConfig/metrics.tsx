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
 * Equations are stored as their expanded aggregates, which read as an implementation
 * detail. Break them into the reference labels (A, B, …) the edit form assigns, plus a
 * row per aggregate described in the same terms that form uses to build it.
 *
 * The detector's own filter is not an aggregate's filter — it belongs to the equation
 * as a whole, and the details view shows it separately. Aggregates carry only the
 * filter baked into their own `_if` combinator.
 *
 * Returns null for a single aggregate, which has nothing to break out.
 */
function summarizeEquation(aggregate: string): AggregateSummary | null {
  // The detector form holds equations without their `equation|` prefix, while the API
  // stores them with it. Normalize through the same helper used when saving so both
  // forms parse identically.
  const {compactExpression, metricQueries} = parseAggregateExpression(
    getApiAggregateString(aggregate)
  );
  if (!compactExpression) {
    return null;
  }
  // A lone conditional aggregate parses as an equation of one function and collapses
  // to a bare "A", which says nothing. Leave those as they are.
  if (metricQueries.length === 1 && compactExpression === metricQueries[0]?.label) {
    return null;
  }

  return {
    // The compact expression joins every token with a space, including parentheses,
    // which reads as "( A + B ) % C". Tighten them back up for display.
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
    // Equations read better as their reference labels, whether or not the caller has
    // already prefixed them.
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
