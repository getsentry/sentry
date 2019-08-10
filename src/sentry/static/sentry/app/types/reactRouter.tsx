// References
// https://github.com/ReactTraining/history/blob/3b208201c35a54e6d660654c105c394224fdede7/modules/useQueries.js#L31
// https://github.com/sindresorhus/query-string/blob/master/index.d.ts#L92-L94
// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/history/v3/index.d.ts#L40

import {Pathname, Search, Hash, LocationState, Action, LocationKey} from 'history';

type Query<T = string> = {
  [key: string]: T | T[] | null | undefined;
};

export interface ReactRouterLocation {
  pathname: Pathname;
  search: Search;
  query: Query;
  hash: Hash;
  state: LocationState;
  action: Action;
  key: LocationKey;
}
