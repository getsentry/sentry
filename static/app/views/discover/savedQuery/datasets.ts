import type {Location} from 'history';

import {DiscoverDatasets, SavedQueryDatasets} from 'sentry/utils/discover/types';
import {
  loadQueryParamsFromLocation,
  parseAsScalar,
} from 'sentry/views/explore/queryParams/parsers';

const datasetParsers = {dataset: parseAsScalar, queryDataset: parseAsScalar};

function loadDatasetParams(location: Location | undefined) {
  return location
    ? loadQueryParamsFromLocation(datasetParsers, location)
    : {dataset: null, queryDataset: null};
}

export function getDatasetFromLocationOrSavedQueryDataset(
  location: Location | undefined,
  queryDataset: SavedQueryDatasets | undefined
): DiscoverDatasets | undefined {
  const params = loadDatasetParams(location);
  if (params.dataset) {
    return params.dataset as DiscoverDatasets;
  }
  const savedQueryDataset = params.queryDataset ?? queryDataset;
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
  const params = loadDatasetParams(location);
  if (params.queryDataset) {
    return params.queryDataset as SavedQueryDatasets;
  }
  const discoverDataset = params.dataset ?? dataset;
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
