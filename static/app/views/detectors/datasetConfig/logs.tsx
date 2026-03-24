import {t} from 'sentry/locale';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {LogsConfig} from 'sentry/views/dashboards/datasetConfig/logs';
import {createEapDetectorConfig} from 'sentry/views/detectors/datasetConfig/eapBase';

export const DetectorLogsConfig = createEapDetectorConfig({
  name: t('Logs'),
  defaultEventTypes: [EventTypes.TRACE_ITEM_LOG],
  defaultField: LogsConfig.defaultField,
  getAggregateOptions: LogsConfig.getTableFieldOptions,
  discoverDataset: DiscoverDatasets.OURLOGS,
  formatAggregateForTitle: aggregate => {
    if (aggregate === 'count()') {
      return t('Number of logs');
    }
    return aggregate;
  },
});
