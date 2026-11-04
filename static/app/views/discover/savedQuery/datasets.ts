import type {Location} from 'history';

import {DiscoverDatasets, SavedQueryDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';

export function getDatasetFromLocationOrSavedQueryDataset(
  location: Location | undefined,
  queryDataset: SavedQueryDatasets | undefined
): DiscoverDatasets | undefined {
  const dataset = decodeScalar(location?.query?.dataset);
  if (dataset) {
    return dataset as DiscoverDatasets;
  }
  const savedQueryDataset = decodeScalar(location?.query?.queryDataset) ?? queryDataset;
  switch (savedQueryDataset) {
    case SavedQueryDatasets.ERRORS:
      return DiscoverDatasets.ERRORS;
    case SavedQueryDatasets.TRANSACTIONS:
      return DiscoverDatasets.TRANSACTIONS;
    case SavedQueryDatasets.DISCOVER:
      return DiscoverDatasets.DISCOVER;
    default:
      return undefined;
  }
}

export function getSavedQueryDatasetFromLocationOrDataset(
  location: Location | undefined,
  dataset: DiscoverDatasets | undefined
): SavedQueryDatasets | undefined {
  const savedQueryDataset = decodeScalar(location?.query?.queryDataset);
  if (savedQueryDataset) {
    return savedQueryDataset as SavedQueryDatasets;
  }
  const discoverDataset = decodeScalar(location?.query?.dataset) ?? dataset;
  switch (discoverDataset) {
    case DiscoverDatasets.ERRORS:
      return SavedQueryDatasets.ERRORS;
    case DiscoverDatasets.TRANSACTIONS:
      return SavedQueryDatasets.TRANSACTIONS;
    case DiscoverDatasets.DISCOVER:
      return SavedQueryDatasets.DISCOVER;
    default:
      return undefined;
  }
}
