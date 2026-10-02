import type {Location} from 'history';
import * as qs from 'query-string';

export function LocationFixture(params: Partial<Location> = {}): Location {
  const location: Location = {
    key: '',
    search: '',
    hash: '',
    action: 'PUSH',
    state: null,
    query: {},
    pathname: '/mock-pathname/',
    ...params,
  };

  // Most Sentry code reads `location.query`, but anything parsing the raw URL —
  // nuqs in particular — reads `location.search`. A fixture that sets only one
  // of them is a location that cannot exist, so keep the two in agreement.
  if (params.search === undefined && params.query) {
    const search = qs.stringify(params.query);
    location.search = search ? `?${search}` : '';
  }

  return location;
}
