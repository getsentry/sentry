import type {Location} from 'history';

import {stringify} from 'sentry/utils/url/qs';

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
    const search = stringify(params.query);
    location.search = search ? `?${search}` : '';
  }

  return location;
}
