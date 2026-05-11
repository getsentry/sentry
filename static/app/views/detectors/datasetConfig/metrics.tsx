import {t} from 'sentry/locale';
import {isEquation, stripEquationPrefix} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {TraceMetricsConfig} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {MetricsDetectorSearchBar} from 'sentry/views/detectors/datasetConfig/components/metricsSearchBar';
import {createEapDetectorConfig} from 'sentry/views/detectors/datasetConfig/eapBase';
import {transformEventsStatsToSeries} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';

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
});
