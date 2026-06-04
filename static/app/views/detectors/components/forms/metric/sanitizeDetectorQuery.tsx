import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

/**
 * The default "number of errors" template includes "is:unresolved", which
 * is not supported by any other datasets. To avoid invalid queries when
 * the user changes the dataset, we remove it from the query.
 */
export function sanitizeDetectorQuery({
  dataset,
  query,
}: {
  dataset: DetectorDataset;
  query: string;
}): string {
  if (dataset === DetectorDataset.ERRORS || !query) {
    return query;
  }
  const mutableSearch = new MutableSearch(query);
  mutableSearch.removeFilter('is');
  return mutableSearch.formatString();
}
