import type {Location} from 'history';

export default function LocationFixture(params: Partial<Location> = {}): Location {
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
