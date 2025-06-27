import {ErrorsConfig} from 'sentry/views/dashboards/datasetConfig/errors';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';

/**
 * @returns a configuration object used to display the aggregate function selector and the search bar
 */
export function getDatasetConfig(dataset: DetectorDataset) {
  switch (dataset) {
    case DetectorDataset.ERRORS:
      return ErrorsConfig;
    case DetectorDataset.TRANSACTIONS:
      return TransactionsConfig;
    case DetectorDataset.RELEASES:
      return ReleasesConfig;
    case DetectorDataset.SPANS:
      return SpansConfig;
    default:
      return ErrorsConfig;
  }
}
