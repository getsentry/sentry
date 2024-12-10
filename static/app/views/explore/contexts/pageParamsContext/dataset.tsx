import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';

export function defaultDataset(): DiscoverDatasets {
  return DiscoverDatasets.SPANS_EAP;
}

export function getDatasetFromLocation(location: Location): DiscoverDatasets {
  const rawDataset = decodeScalar(location.query.dataset);
  return parseDataset(rawDataset);
}

export function parseDataset(rawDataset: string | undefined) {
  if (rawDataset === 'spansIndexed') {
    return DiscoverDatasets.SPANS_INDEXED;
  }

  if (rawDataset === 'spansRpc') {
    return DiscoverDatasets.SPANS_EAP_RPC;
  }

  return defaultDataset();
}

export function updateLocationWithDataset(
  location: Location,
  dataset: DiscoverDatasets | null | undefined
) {
  if (defined(dataset)) {
    location.query.dataset = dataset;
  } else if (dataset === null) {
    delete location.query.dataset;
  }
}
