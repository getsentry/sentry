import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';

export function defaultDataset(): DiscoverDatasets | undefined {
  return undefined;
}

export function getDatasetFromLocation(location: Location): DiscoverDatasets | undefined {
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

  if (rawDataset === 'spans') {
    return DiscoverDatasets.SPANS_EAP;
  }

  return undefined;
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
