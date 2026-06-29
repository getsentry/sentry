import type {Location} from 'history';

export function removeHistogramQueryStrings(location: Location, zoomKeys: string[]) {
  const query: Location['query'] = {...location.query, cursor: undefined};

  delete query.dataFilter;
  // reset all zoom parameters
  zoomKeys.forEach(key => delete query[key]);

  return query;
}
