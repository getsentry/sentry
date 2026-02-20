import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {TraceMetricsConfig} from 'sentry/views/dashboards/datasetConfig/traceMetrics';
import {createEapDetectorConfig} from 'sentry/views/detectors/datasetConfig/eapBase';

export const DetectorMetricsConfig = createEapDetectorConfig({
  name: t('Metrics'),
  defaultEventTypes: [EventTypes.TRACE_ITEM_METRIC],
  defaultField: TraceMetricsConfig.defaultField,
  getAggregateOptions: TraceMetricsConfig.getTableFieldOptions,
  discoverDataset: DiscoverDatasets.TRACEMETRICS,
  formatAggregateForTitle: aggregate => {
    if (aggregate === 'count()') {
      return t('Number of metrics');
    }
    return aggregate;
  },
});
