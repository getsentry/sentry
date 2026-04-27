import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {isTokenFunction} from 'sentry/components/arithmeticBuilder/token';
import {t} from 'sentry/locale';
import {
  EQUATION_PREFIX,
  isEquation,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {TraceMetricsConfig} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {MetricsDetectorSearchBar} from 'sentry/views/detectors/datasetConfig/components/metricsSearchBar';
import {createEapDetectorConfig} from 'sentry/views/detectors/datasetConfig/eapBase';
import {transformEventsStatsToSeries} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';
import {
  translateAggregateTag,
  translateAggregateTagBack,
} from 'sentry/views/detectors/datasetConfig/utils/translateAggregateTag';

export const DetectorMetricsConfig = createEapDetectorConfig({
  name: t('Metrics'),
  defaultEventTypes: [EventTypes.TRACE_ITEM_METRIC],
  defaultField: TraceMetricsConfig.defaultField,
  getAggregateOptions: TraceMetricsConfig.getTableFieldOptions,
  discoverDataset: DiscoverDatasets.TRACEMETRICS,
  SearchBar: MetricsDetectorSearchBar,
  formatAggregateForTitle: aggregate => {
    if (aggregate === 'count()') {
      return t('Number of metrics');
    }
    if (isEquation(aggregate)) {
      return stripEquationPrefix(aggregate);
    }
    return aggregate;
  },
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

    return translateAggregateTag(aggregate);
  },
  toApiAggregate: aggregate => {
    aggregate = translateAggregateTagBack(aggregate);

    // Check to see if this aggregate is an equation with more than one function
    // This is the most reliable way we have to determine if this is an equation
    const expression = new Expression(aggregate);
    const functions = expression.tokens.filter(token => isTokenFunction(token));
    if (!isEquation(aggregate) && expression.isValid && functions.length > 1) {
      return `${EQUATION_PREFIX}${aggregate}`;
    }

    return aggregate;
  },
  supportsEquations: true,
});
