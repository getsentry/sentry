import type {Location} from 'history';

export function LocationFixture(params: Partial<Location> = {}): Location {
  return {
    key: '',
    search: '',
    hash: '',
    action: 'PUSH',
    state: null,
    query: {},
    pathname: '/mock-pathname/',
    ...params,
  };
}

// TODO(epurkhiser): Remove once removed from getsentry
export default LocationFixture;
