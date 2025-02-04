import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeQuery} from 'sentry/utils/discover/eventView';

export function defaultQuery(): string {
  return '';
}

export function getQueryFromLocation(location: Location) {
  return decodeQuery(location);
}

export function updateLocationWithQuery(
  location: Location,
  query: string | null | undefined
) {
  if (defined(query)) {
    location.query.query = query;

    // make sure to clear the cursor every time the query is updated
    delete location.query.cursor;
  } else if (query === null) {
    delete location.query.query;
  }
}
